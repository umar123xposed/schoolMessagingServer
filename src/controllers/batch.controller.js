const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { batchService, userService, studentImportService } = require('../services');

const createBatch = catchAsync(async (req, res) => {
  const batch = await batchService.createBatch(req.body);
  res.status(httpStatus.CREATED).send(batch);
});

const getBatches = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await batchService.queryBatches(filter, options);
  res.send(result);
});

const getBatch = catchAsync(async (req, res) => {
  const batch = await batchService.getBatchById(req.params.batchId);
  if (!batch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');
  }
  res.send(batch);
});

const updateBatch = catchAsync(async (req, res) => {
  const batch = await batchService.updateBatchById(req.params.batchId, req.body);
  res.send(batch);
});

const deleteBatch = catchAsync(async (req, res) => {
  const job = await batchService.deleteBatchById(req.params.batchId, req.body.confirmName, req.user);
  res.status(httpStatus.ACCEPTED).send(job);
});

const getBatchStudents = catchAsync(async (req, res) => {
  const batch = await batchService.getBatchById(req.params.batchId);
  if (!batch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers({ batchId: req.params.batchId, role: 'student' }, options);
  res.send(result);
});

const importStudents = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'CSV file is required');
  }
  const result = await studentImportService.importStudentsForBatch(req.params.batchId, req.file.buffer, req.user);
  res.status(httpStatus.CREATED).send(result);
});

module.exports = {
  createBatch,
  getBatches,
  getBatch,
  updateBatch,
  deleteBatch,
  getBatchStudents,
  importStudents,
};
