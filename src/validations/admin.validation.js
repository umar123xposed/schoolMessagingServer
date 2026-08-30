const Joi = require('joi');
const { objectId } = require('./custom.validation');

const deleteBatch = {
  params: Joi.object().keys({
    batchLabel: Joi.string().required(),
  }),
  body: Joi.object().keys({
    confirmBatchLabel: Joi.string().required(),
  }),
};

const getBatchDeletionJobs = {
  query: Joi.object().keys({
    status: Joi.string().valid('pending', 'running', 'completed', 'failed'),
    batchLabel: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getBatchDeletionJob = {
  params: Joi.object().keys({
    jobId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  deleteBatch,
  getBatchDeletionJobs,
  getBatchDeletionJob,
};
