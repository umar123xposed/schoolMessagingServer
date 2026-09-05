const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getBatchDeletionJobs = {
  query: Joi.object().keys({
    status: Joi.string().valid('pending', 'running', 'completed', 'failed'),
    batchId: Joi.string().custom(objectId),
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
  getBatchDeletionJobs,
  getBatchDeletionJob,
};
