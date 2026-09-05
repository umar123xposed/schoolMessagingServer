const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { batchDeletionService } = require('../services');

const getStorageStats = catchAsync(async (req, res) => {
  const stats = await batchDeletionService.getStorageStats();
  res.send(stats);
});

const getBatchDeletionJobs = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['status', 'batchId']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await batchDeletionService.queryBatchDeletionJobs(filter, options);
  res.send(result);
});

const getBatchDeletionJob = catchAsync(async (req, res) => {
  const job = await batchDeletionService.getBatchDeletionJob(req.params.jobId);
  if (!job) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Batch deletion job not found');
  }
  res.send(job);
});

module.exports = {
  getStorageStats,
  getBatchDeletionJobs,
  getBatchDeletionJob,
};
