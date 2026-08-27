const httpStatus = require('http-status');
const { Label } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a label
 * @param {Object} labelBody
 * @returns {Promise<Label>}
 */
const createLabel = async (labelBody) => {
  if (await Label.isNameTaken(labelBody.name)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Label name already taken');
  }
  return Label.create(labelBody);
};

/**
 * Query for labels
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const queryLabels = async (filter, options) => {
  return Label.paginate(filter, options);
};

/**
 * Get a label by id
 * @param {ObjectId} id
 * @returns {Promise<Label>}
 */
const getLabelById = async (id) => {
  return Label.findById(id);
};

/**
 * Update a label by id
 * @param {ObjectId} labelId
 * @param {Object} updateBody
 * @returns {Promise<Label>}
 */
const updateLabelById = async (labelId, updateBody) => {
  const label = await getLabelById(labelId);
  if (!label) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Label not found');
  }
  if (updateBody.name && (await Label.isNameTaken(updateBody.name, labelId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Label name already taken');
  }
  Object.assign(label, updateBody);
  await label.save();
  return label;
};

/**
 * Delete a label by id
 * @param {ObjectId} labelId
 * @returns {Promise<Label>}
 */
const deleteLabelById = async (labelId) => {
  const label = await getLabelById(labelId);
  if (!label) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Label not found');
  }
  await label.remove();
  return label;
};

module.exports = {
  createLabel,
  queryLabels,
  getLabelById,
  updateLabelById,
  deleteLabelById,
};
