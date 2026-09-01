const Joi = require('joi');
const { objectId } = require('./custom.validation');

const contentTypes = ['text', 'image', 'audio', 'voice_note', 'video', 'pdf', 'file'];

const attachmentSchema = Joi.object().keys({
  url: Joi.string().required(),
  mimeType: Joi.string(),
  size: Joi.number(),
  fileName: Joi.string(),
  duration: Joi.number().min(0), // seconds - audio/voice_note/video only
});

const messageContentSchema = Joi.object().keys({
  contentType: Joi.string()
    .required()
    .valid(...contentTypes),
  text: Joi.string().when('contentType', { is: 'text', then: Joi.required() }),
  attachment: attachmentSchema.when('contentType', { is: 'text', otherwise: Joi.required() }),
});

const getMessages = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const sendMessages = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
  body: Joi.alternatives().try(messageContentSchema, Joi.array().items(messageContentSchema).min(1)),
};

const pinMessage = {
  params: Joi.object().keys({
    messageId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({
    isPinned: Joi.boolean().required(),
  }),
};

const deleteMessage = {
  params: Joi.object().keys({
    messageId: Joi.string().custom(objectId),
  }),
};

const broadcastMessage = {
  body: messageContentSchema
    .keys({
      targetConversationIds: Joi.array().items(Joi.string().custom(objectId)).min(1),
      toAll: Joi.boolean(),
    })
    .xor('targetConversationIds', 'toAll'),
};

module.exports = {
  getMessages,
  sendMessages,
  pinMessage,
  deleteMessage,
  broadcastMessage,
};
