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
  if (await Template.isShortcutTaken(templateBody.shortcut)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Shortcut already taken');
  }
  return Template.create({ ...templateBody, createdBy: creator._id });
};

/**
 * Query for templates visible to a user (their own, plus every shared one)
 * @param {User} user
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const queryTemplatesForUser = async (user, filter, options) => {
  const combinedFilter = { $and: [{ $or: [{ createdBy: user._id }, { isShared: true }] }, filter] };
  return Template.paginate(combinedFilter, options);
};

/**
 * Get a template by id
 * @param {ObjectId} id
 * @returns {Promise<Template>}
 */
const getTemplateById = async (id) => {
  return Template.findById(id);
};

const assertUserCanManageTemplate = (template, user) => {
  if (String(template.createdBy) !== String(user._id) && user.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
};

/**
 * Update a template - allowed for its creator or super_admin
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
  assertUserCanManageTemplate(template, user);
  if (updateBody.shortcut && (await Template.isShortcutTaken(updateBody.shortcut, templateId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Shortcut already taken');
  }
  Object.assign(template, updateBody);
  await template.save();
  return template;
};

/**
 * Delete a template - allowed for its creator or super_admin
 * @param {ObjectId} templateId
 * @param {User} user
 * @returns {Promise<Template>}
 */
const deleteTemplateById = async (templateId, user) => {
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Template not found');
  }
  assertUserCanManageTemplate(template, user);
  await template.remove();
  return template;
};

module.exports = {
  createTemplate,
  queryTemplatesForUser,
  getTemplateById,
  updateTemplateById,
  deleteTemplateById,
};
