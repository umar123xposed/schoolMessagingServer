const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { uploadService } = require('../services');

const uploadFile = catchAsync(async (req, res) => {
  const { contentType, ...declared } = req.body;
  const result = await uploadService.createPresignedUpload(contentType, declared);
  res.status(httpStatus.CREATED).send(result);
});

module.exports = {
  uploadFile,
};
