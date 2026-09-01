const crypto = require('crypto');
const path = require('path');
const httpStatus = require('http-status');
const { S3Client, PutObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

const R2_DELETE_BATCH_SIZE = 1000; // S3 DeleteObjectsCommand's per-request limit

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
  forcePathStyle: true,
});

const DANGEROUS_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.sh', '.com', '.msi', '.ps1', '.js', '.jar', '.app', '.scr']);

// Server-side ceilings, independent of client-side compression - never trust the client's word on size/type.
const CONTENT_TYPE_RULES = {
  image: { maxSizeBytes: 10 * 1024 * 1024, isAllowed: (file) => file.mimetype.startsWith('image/') },
  audio: { maxSizeBytes: 20 * 1024 * 1024, isAllowed: (file) => file.mimetype.startsWith('audio/') },
  voice_note: { maxSizeBytes: 8 * 1024 * 1024, isAllowed: (file) => file.mimetype.startsWith('audio/') },
  video: { maxSizeBytes: 60 * 1024 * 1024, isAllowed: (file) => file.mimetype.startsWith('video/') },
  pdf: { maxSizeBytes: 20 * 1024 * 1024, isAllowed: (file) => file.mimetype === 'application/pdf' },
  file: {
    maxSizeBytes: 30 * 1024 * 1024,
    isAllowed: (file) => !DANGEROUS_EXTENSIONS.has(path.extname(file.originalname).toLowerCase()),
  },
};

/**
 * Validate a multer file against the rules for a declared message contentType
 * @param {Object} file - multer's req.file: { buffer, mimetype, size, originalname }
 * @param {string} contentType
 */
const validateFileAgainstContentType = (file, contentType) => {
  const rule = CONTENT_TYPE_RULES[contentType];
  if (!rule) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Uploads are not supported for contentType "${contentType}"`);
  }
  if (file.size > rule.maxSizeBytes) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `File exceeds the maximum size for ${contentType} (${rule.maxSizeBytes} bytes)`
    );
  }
  if (!rule.isAllowed(file)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `File type "${file.mimetype}" is not allowed for contentType "${contentType}"`
    );
  }
};

/**
 * Upload a buffer to R2
 * @param {string} key
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
const putObject = async (key, buffer, mimeType) => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
};

/**
 * Delete a batch of objects from R2, chunked at R2_DELETE_BATCH_SIZE
 * @param {string[]} keys
 */
const deleteObjects = async (keys) => {
  for (let i = 0; i < keys.length; i += R2_DELETE_BATCH_SIZE) {
    const chunk = keys.slice(i, i + R2_DELETE_BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: config.r2.bucketName,
        Delete: { Objects: chunk.map((key) => ({ Key: key })) },
      })
    );
  }
};

/**
 * Recover the R2 object key from a stored attachment URL (the inverse of the url built in uploadAttachment)
 * @param {string} url
 * @returns {string}
 */
const extractKeyFromUrl = (url) => url.replace(`${config.r2.publicBaseUrl}/`, '');

/**
 * Validate and upload an attachment, returning the metadata shape Message.attachment expects
 * @param {Object} file - multer's req.file
 * @param {string} contentType
 * @param {number} [duration] - seconds, audio/voice_note/video only, passed through as-is
 * @returns {Promise<{url: string, mimeType: string, size: number, fileName: string, duration: number|undefined}>}
 */
const uploadAttachment = async (file, contentType, duration) => {
  validateFileAgainstContentType(file, contentType);

  const key = `attachments/${crypto.randomUUID()}${path.extname(file.originalname)}`;
  // call through module.exports (not the local `putObject` closure) so tests can mock
  // just the network call via jest.spyOn(uploadService, 'putObject')
  await module.exports.putObject(key, file.buffer, file.mimetype);

  return {
    url: `${config.r2.publicBaseUrl}/${key}`,
    mimeType: file.mimetype,
    size: file.size,
    fileName: file.originalname,
    ...(duration !== undefined && { duration }),
  };
};

module.exports = {
  CONTENT_TYPE_RULES,
  validateFileAgainstContentType,
  putObject,
  deleteObjects,
  extractKeyFromUrl,
  uploadAttachment,
};
