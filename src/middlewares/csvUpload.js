const multer = require('multer');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');

// Student roster CSVs are a few hundred/thousand short rows - a couple KB to low MB at most,
// nowhere near attachment territory, so plain server-side multipart handling (not R2) is fine.
const MAX_CSV_BYTES = 2 * 1024 * 1024;

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_BYTES },
}).single('file');

const parseCsvUpload = (req, res, next) => {
  csvUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new ApiError(httpStatus.BAD_REQUEST, err.message));
    }
    if (err) {
      return next(new ApiError(httpStatus.BAD_REQUEST, err.message));
    }
    return next();
  });
};

module.exports = parseCsvUpload;
