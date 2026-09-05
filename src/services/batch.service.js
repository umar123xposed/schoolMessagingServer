const httpStatus = require('http-status');
const { Batch } = require('../models');
const ApiError = require('../utils/ApiError');
const batchDeletionService = require('./batchDeletion.service');

/**
 * Create a batch/cohort
 * @param {Object} batchBody
 * @returns {Promise<Batch>}
 */
const createBatch = async (batchBody) => {
  if (await Batch.isNameTaken(batchBody.name)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Batch name already taken');
  }
  return Batch.create(batchBody);
};

/**
 * Query for batches
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const queryBatches = async (filter, options) => Batch.paginate(filter, options);

/**
 * Get a batch by id
 * @param {ObjectId} id
 * @returns {Promise<Batch>}
 */
const getBatchById = async (id) => Batch.findById(id);

/**
 * Update a batch by id
 * @param {ObjectId} batchId
 * @param {Object} updateBody
 * @returns {Promise<Batch>}
 */
const updateBatchById = async (batchId, updateBody) => {
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');
  }
  if (updateBody.name && (await Batch.isNameTaken(updateBody.name, batchId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Batch name already taken');
  }
  Object.assign(batch, updateBody);
  await batch.save();
  return batch;
};

/**
 * Permanently delete a batch: its students, their conversations/messages, the R2 attachment
 * files, and the batch record itself. This is destructive and irreversible, so it requires
 * the caller to echo the batch's current name as a confirmation (a raw id in the URL is too
 * easy to copy/paste without looking at what it actually points to). The deletion itself runs
 * as a background job - see batchDeletion.service.js - this just validates and starts it.
 * @param {ObjectId} batchId
 * @param {string} confirmName
 * @param {User} triggeredBy
 * @returns {Promise<BatchDeletionJob>}
 */
const deleteBatchById = async (batchId, confirmName, triggeredBy) => {
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');
  }
  if (confirmName !== batch.name) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'confirmName must exactly match the batch being deleted');
  }
  return batchDeletionService.startBatchDeletion(batch, triggeredBy);
};

module.exports = {
  createBatch,
  queryBatches,
  getBatchById,
  updateBatchById,
  deleteBatchById,
};
