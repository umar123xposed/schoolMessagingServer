const httpStatus = require('http-status');
const { Template } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a template
 * @param {User} creator
 * @param {Object} templateBody
 * @returns {Promise<Template>}
 */
const createTemplate = async (creator, templateBody) => {
  if (await Template.isShortcutTaken(templateBody.shortcut, creator._id)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You already have a template with this shortcut');
  }
  return Template.create({ ...templateBody, createdBy: creator._id });
};

/**
 * Query for a user's own templates
 * @param {User} user
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const queryTemplatesForUser = async (user, filter, options) => {
  return Template.paginate({ ...filter, createdBy: user._id }, options);
};

/**
 * Get a template by id
 * @param {ObjectId} id
 * @returns {Promise<Template>}
 */
const getTemplateById = async (id) => {
  return Template.findById(id);
};

/**
 * Templates are private
 * @param {Template} template
 * @param {User} user
 */
const assertUserOwnsTemplate = (template, user) => {
  if (String(template.createdBy) !== String(user._id)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
};

/**
 * Update a template - creator only
 * @param {ObjectId} templateId
 * @param {User} user
 * @param {Object} updateBody
 * @returns {Promise<Template>}
 */
const updateTemplateById = async (templateId, user, updateBody) => {
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Template not found');
  }
  assertUserOwnsTemplate(template, user);
  if (updateBody.shortcut && (await Template.isShortcutTaken(updateBody.shortcut, user._id, templateId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You already have a template with this shortcut');
  }
  Object.assign(template, updateBody);
  await template.save();
  return template;
};

/**
 * Delete a template - creator only
 * @param {ObjectId} templateId
 * @param {User} user
 * @returns {Promise<Template>}
 */
const deleteTemplateById = async (templateId, user) => {
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Template not found');
  }
  assertUserOwnsTemplate(template, user);
  await template.remove();
  return template;
};

module.exports = {
  createTemplate,
  queryTemplatesForUser,
  getTemplateById,
  assertUserOwnsTemplate,
  updateTemplateById,
  deleteTemplateById,
};
