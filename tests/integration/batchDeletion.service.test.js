const mongoose = require('mongoose');
const config = require('../../src/config/config');
const setupTestDB = require('../utils/setupTestDB');
const { User, Conversation, Message, BatchDeletionJob } = require('../../src/models');
const { uploadService, batchDeletionService } = require('../../src/services');
const { superAdmin, agent, insertUsers } = require('../fixtures/user.fixture');

setupTestDB();

// build attachment URLs the same way uploadService.uploadAttachment actually does
// (config.r2.publicBaseUrl + '/' + key), so extractKeyFromUrl round-trips correctly
// regardless of what that config value happens to be in this environment
const attachmentUrlForKey = (key) => `${config.r2.publicBaseUrl}/${key}`;

const makeStudent = (batchLabel) => ({
  _id: mongoose.Types.ObjectId(),
  name: `Student ${batchLabel}`,
  phoneNumber: `+1${Math.floor(1000000000 + Math.random() * 8999999999)}`,
  password: 'password1',
  role: 'student',
  batchLabel,
});

const makeConversation = (studentId) => ({
  _id: mongoose.Types.ObjectId(),
  type: 'student_support',
  studentId,
  createdBy: studentId,
  labels: [],
});

const makeMessage = (conversationId, senderId, attachmentUrl) => ({
  _id: mongoose.Types.ObjectId(),
  conversationId,
  senderId,
  contentType: attachmentUrl ? 'image' : 'text',
  text: attachmentUrl ? undefined : 'hello',
  attachment: attachmentUrl ? { url: attachmentUrl, mimeType: 'image/jpeg', size: 1024, fileName: 'photo.jpg' } : undefined,
});

describe('batchDeletion.service', () => {
  describe('getStorageStats', () => {
    test('returns a per-batch breakdown and grand total', async () => {
      const studentA = makeStudent('batch-A');
      const studentB = makeStudent('batch-B');
      await User.insertMany([studentA, studentB]);

      const conversationA = makeConversation(studentA._id);
      const conversationB = makeConversation(studentB._id);
      await Conversation.insertMany([conversationA, conversationB]);

      await Message.insertMany([
        makeMessage(conversationA._id, studentA._id, attachmentUrlForKey('attachments/a.jpg')),
        makeMessage(conversationA._id, studentA._id),
        makeMessage(conversationB._id, studentB._id, attachmentUrlForKey('attachments/b.jpg')),
      ]);

      const stats = await batchDeletionService.getStorageStats();

      const batchAStats = stats.batches.find((b) => b.batchLabel === 'batch-A');
      const batchBStats = stats.batches.find((b) => b.batchLabel === 'batch-B');

      expect(batchAStats).toMatchObject({ studentCount: 1, conversationCount: 1, messageCount: 2, attachmentCount: 1 });
      expect(batchBStats).toMatchObject({ studentCount: 1, conversationCount: 1, messageCount: 1, attachmentCount: 1 });
      expect(stats.total.studentCount).toBe(2);
      expect(stats.total.messageCount).toBe(3);
      expect(stats.total.attachmentCount).toBe(2);
    });
  });

  describe('runBatchDeletion', () => {
    test('deletes only the target batch, cleans up R2 objects, and marks the job completed', async () => {
      jest.spyOn(uploadService, 'deleteObjects').mockResolvedValue();

      const studentA = makeStudent('batch-A');
      const studentB = makeStudent('batch-B');
      await insertUsers([studentA, studentB]);
      await insertUsers([superAdmin]);

      const conversationA = makeConversation(studentA._id);
      const conversationB = makeConversation(studentB._id);
      await Conversation.insertMany([conversationA, conversationB]);

      await Message.insertMany([
        makeMessage(conversationA._id, studentA._id, attachmentUrlForKey('attachments/a1.jpg')),
        makeMessage(conversationA._id, studentA._id, attachmentUrlForKey('attachments/a2.jpg')),
        makeMessage(conversationB._id, studentB._id, attachmentUrlForKey('attachments/b1.jpg')),
      ]);

      // create the job directly (not via startBatchDeletion, which schedules its own
      // setImmediate run internally - calling both would race two executions of the same job)
      const job = await BatchDeletionJob.create({ batchLabel: 'batch-A', triggeredBy: superAdmin._id });
      await batchDeletionService.runBatchDeletion(job.id);

      const dbJob = await BatchDeletionJob.findById(job.id);
      expect(dbJob.status).toBe('completed');
      expect(dbJob.counts).toMatchObject({ students: 1, conversations: 1, messages: 2, attachmentsDeleted: 2 });

      expect(await User.findById(studentA._id)).toBeNull();
      expect(await Conversation.findById(conversationA._id)).toBeNull();
      expect(await Message.countDocuments({ conversationId: conversationA._id })).toBe(0);

      expect(await User.findById(studentB._id)).not.toBeNull();
      expect(await Conversation.findById(conversationB._id)).not.toBeNull();
      expect(await Message.countDocuments({ conversationId: conversationB._id })).toBe(1);

      expect(uploadService.deleteObjects).toHaveBeenCalledWith(
        expect.arrayContaining(['attachments/a1.jpg', 'attachments/a2.jpg'])
      );
      expect(uploadService.deleteObjects.mock.calls[0][0]).toHaveLength(2);
    });

    test('marks the job failed (not silently stuck) if a step throws', async () => {
      jest.spyOn(uploadService, 'deleteObjects').mockRejectedValue(new Error('R2 is down'));

      const student = makeStudent('batch-C');
      await insertUsers([student, superAdmin]);
      const conversation = makeConversation(student._id);
      await Conversation.insertMany([conversation]);
      await Message.insertMany([makeMessage(conversation._id, student._id, attachmentUrlForKey('attachments/c1.jpg'))]);

      const job = await BatchDeletionJob.create({ batchLabel: 'batch-C', triggeredBy: superAdmin._id });
      await batchDeletionService.runBatchDeletion(job.id);

      const dbJob = await BatchDeletionJob.findById(job.id);
      expect(dbJob.status).toBe('failed');
      expect(dbJob.error).toContain('R2 is down');

      // nothing should have been deleted since the R2 step failed before any DB deletes
      expect(await User.findById(student._id)).not.toBeNull();
    });

    test('rejects a non-super_admin trying to start a batch deletion', async () => {
      await insertUsers([agent]);

      await expect(batchDeletionService.startBatchDeletion('batch-A', agent)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });
});
