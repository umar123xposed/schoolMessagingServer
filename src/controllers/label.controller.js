const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { labelService } = require('../services');

const createLabel = catchAsync(async (req, res) => {
  const label = await labelService.createLabel(req.body);
  res.status(httpStatus.CREATED).send(label);
});

const getLabels = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await labelService.queryLabels(filter, options);
  res.send(result);
});

const getLabel = catchAsync(async (req, res) => {
  const label = await labelService.getLabelById(req.params.labelId);
  if (!label) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Label not found');
  }
  res.send(label);
});

const updateLabel = catchAsync(async (req, res) => {
  const label = await labelService.updateLabelById(req.params.labelId, req.body);
  res.send(label);
});

const deleteLabel = catchAsync(async (req, res) => {
  await labelService.deleteLabelById(req.params.labelId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createLabel,
  getLabels,
  getLabel,
  updateLabel,
  deleteLabel,
};
