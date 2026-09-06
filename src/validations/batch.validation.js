const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createBatch = {
  body: Joi.object().keys({
    name: Joi.string().required(),
  }),
};

const getBatches = {
  query: Joi.object().keys({
    name: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getBatch = {
  params: Joi.object().keys({
    batchId: Joi.string().custom(objectId),
  }),
};

const updateBatch = {
  params: Joi.object().keys({
    batchId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string(),
    })
    .min(1),
};

const deleteBatch = {
  params: Joi.object().keys({
    batchId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({
    confirmName: Joi.string().required(),
  }),
};

const getBatchStudents = {
  params: Joi.object().keys({
    batchId: Joi.required().custom(objectId),
  }),
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const importStudents = {
  params: Joi.object().keys({
    batchId: Joi.required().custom(objectId),
  }),
};

module.exports = {
  createBatch,
  getBatches,
  getBatch,
  updateBatch,
  deleteBatch,
  getBatchStudents,
  importStudents,
};
