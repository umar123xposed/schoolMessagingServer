const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createTemplate = {
  body: Joi.object().keys({
    shortcut: Joi.string().required(),
    content: Joi.string().required(),
    isShared: Joi.boolean(),
  }),
};

const getTemplates = {
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getTemplate = {
  params: Joi.object().keys({
    templateId: Joi.string().custom(objectId),
  }),
};

const updateTemplate = {
  params: Joi.object().keys({
    templateId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      shortcut: Joi.string(),
      content: Joi.string(),
      isShared: Joi.boolean(),
    })
    .min(1),
};

const deleteTemplate = {
  params: Joi.object().keys({
    templateId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
};
