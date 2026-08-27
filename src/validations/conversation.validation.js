const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getConversations = {
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const createGroup = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    participantIds: Joi.array().items(Joi.string().custom(objectId)).min(1).required(),
  }),
};

const getConversation = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
};

const updateGroup = {
  params: Joi.object().keys({
    conversationId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string(),
      participantIds: Joi.array().items(Joi.string().custom(objectId)).min(1),
    })
    .min(1),
};

const updateLabels = {
  params: Joi.object().keys({
    conversationId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({
    labels: Joi.array().items(Joi.string().custom(objectId)).required(),
  }),
};

const deleteConversation = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  getConversations,
  createGroup,
  getConversation,
  updateGroup,
  updateLabels,
  deleteConversation,
};
