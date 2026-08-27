const multer = require('multer');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');

// One blunt global ceiling as an abuse safety net - the real per-contentType policy
// (size + mime rules) is enforced afterwards in services/upload.service.js, once both the
// contentType field and the file are guaranteed parsed regardless of multipart field order.
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
}).single('file');

const parseUpload = (req, res, next) => {
  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new ApiError(httpStatus.BAD_REQUEST, err.message));
    }
    if (err) {
      return next(new ApiError(httpStatus.BAD_REQUEST, err.message));
    }
    return next();
  });
};

module.exports = parseUpload;
