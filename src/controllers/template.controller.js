const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { templateService } = require('../services');

const createTemplate = catchAsync(async (req, res) => {
  const template = await templateService.createTemplate(req.user, req.body);
  res.status(httpStatus.CREATED).send(template);
});

const getTemplates = catchAsync(async (req, res) => {
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await templateService.queryTemplatesForUser(req.user, {}, options);
  res.send(result);
});

const getTemplate = catchAsync(async (req, res) => {
  const template = await templateService.getTemplateById(req.params.templateId);
  if (!template) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Template not found');
  }
  templateService.assertUserOwnsTemplate(template, req.user);
  res.send(template);
});

const updateTemplate = catchAsync(async (req, res) => {
  const template = await templateService.updateTemplateById(req.params.templateId, req.user, req.body);
  res.send(template);
});

const deleteTemplate = catchAsync(async (req, res) => {
  await templateService.deleteTemplateById(req.params.templateId, req.user);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
};
