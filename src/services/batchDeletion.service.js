const httpStatus = require('http-status');
const logger = require('../config/logger');
const { User, Conversation, Message, BatchDeletionJob } = require('../models');
const ApiError = require('../utils/ApiError');
const uploadService = require('./upload.service');

/**
 * Live storage usage broken down by student batch/cohort, computed from our own DB
 * (Message.attachment.size, captured at upload time) rather than listing the R2 bucket.
 * @returns {Promise<{batches: Object[], total: Object}>}
 */
const getStorageStats = async () => {
  const batches = await Conversation.aggregate([
    { $match: { type: 'student_support' } },
    { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $lookup: { from: 'messages', localField: '_id', foreignField: 'conversationId', as: 'messages' } },
    { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$student.batchLabel', 'unassigned'] },
        studentIds: { $addToSet: '$student._id' },
        conversationIds: { $addToSet: '$_id' },
        messageCount: { $sum: { $cond: [{ $ifNull: ['$messages._id', false] }, 1, 0] } },
        attachmentCount: { $sum: { $cond: [{ $ifNull: ['$messages.attachment.url', false] }, 1, 0] } },
        attachmentBytes: { $sum: { $ifNull: ['$messages.attachment.size', 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        batchLabel: '$_id',
        studentCount: { $size: '$studentIds' },
        conversationCount: { $size: '$conversationIds' },
        messageCount: 1,
        attachmentCount: 1,
        attachmentBytes: 1,
      },
    },
    { $sort: { batchLabel: 1 } },
  ]);

  const total = batches.reduce(
    (acc, batch) => ({
      studentCount: acc.studentCount + batch.studentCount,
      conversationCount: acc.conversationCount + batch.conversationCount,
      messageCount: acc.messageCount + batch.messageCount,
      attachmentCount: acc.attachmentCount + batch.attachmentCount,
      attachmentBytes: acc.attachmentBytes + batch.attachmentBytes,
    }),
    { studentCount: 0, conversationCount: 0, messageCount: 0, attachmentCount: 0, attachmentBytes: 0 }
  );

  return { batches, total };
};

/**
 * Do the actual bulk deletion for a batch: R2 files first, then messages, conversations,
 * users - in that order so a job that dies partway never leaves orphaned R2 storage (the
 * failure mode CLAUDE.md explicitly warns is the easiest mistake to make here).
 * Re-queries fresh from the DB rather than a precomputed list, so re-running this for the
 * same batchLabel after a failure just picks up whatever's left.
 * @param {ObjectId} jobId
 */
const runBatchDeletion = async (jobId) => {
  const job = await BatchDeletionJob.findById(jobId);
  if (!job) {
    return;
  }

  job.status = 'running';
  job.startedAt = new Date();
  await job.save();

  try {
    const students = await User.find({ role: 'student', batchLabel: job.batchLabel }, '_id');
    const studentIds = students.map((student) => student._id);

    const conversations = await Conversation.find({ type: 'student_support', studentId: { $in: studentIds } }, '_id');
    const conversationIds = conversations.map((conversation) => conversation._id);

    const messages = await Message.find({ conversationId: { $in: conversationIds } }, 'attachment');
    const keys = messages
      .filter((message) => message.attachment && message.attachment.url)
      .map((message) => uploadService.extractKeyFromUrl(message.attachment.url));

    if (keys.length) {
      await uploadService.deleteObjects(keys);
    }

    await Message.deleteMany({ conversationId: { $in: conversationIds } });
    await Conversation.deleteMany({ _id: { $in: conversationIds } });
    await User.deleteMany({ _id: { $in: studentIds } });

    job.counts = {
      students: studentIds.length,
      conversations: conversationIds.length,
      messages: messages.length,
      attachmentsDeleted: keys.length,
    };
    job.status = 'completed';
    job.finishedAt = new Date();
    await job.save();
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.finishedAt = new Date();
    await job.save();
    logger.error(error);
  }
};

/**
 * Kick off a batch deletion job - super_admin only, checked by the caller (service and
 * route layer both, per this codebase's convention for destructive/admin-only actions).
 * Returns immediately; the actual deletion runs in the background via setImmediate (no
 * Redis/queue in Phase 1, so this is a fire-and-forget in-process job instead).
 * @param {string} batchLabel
 * @param {User} triggeredBy
 * @returns {Promise<BatchDeletionJob>}
 */
const startBatchDeletion = async (batchLabel, triggeredBy) => {
  if (triggeredBy.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
  const job = await BatchDeletionJob.create({ batchLabel, triggeredBy: triggeredBy._id });
  setImmediate(() => {
    runBatchDeletion(job.id).catch((error) => logger.error(error));
  });
  return job;
};

/**
 * @param {ObjectId} jobId
 * @returns {Promise<BatchDeletionJob>}
 */
const getBatchDeletionJob = async (jobId) => BatchDeletionJob.findById(jobId);

/**
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const queryBatchDeletionJobs = async (filter, options) => BatchDeletionJob.paginate(filter, options);

module.exports = {
  getStorageStats,
  runBatchDeletion,
  startBatchDeletion,
  getBatchDeletionJob,
  queryBatchDeletionJobs,
};
