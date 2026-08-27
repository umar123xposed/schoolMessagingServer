const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { uploadService } = require('../services');

const uploadFile = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'File is required');
  }
  const attachment = await uploadService.uploadAttachment(req.file, req.body.contentType);
  res.status(httpStatus.CREATED).send(attachment);
});

module.exports = {
  uploadFile,
};
