const crypto = require('crypto');
const path = require('path');
const httpStatus = require('http-status');
const { S3Client, PutObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

const R2_DELETE_BATCH_SIZE = 1000; // S3 DeleteObjectsCommand's per-request limit
const UPLOAD_URL_EXPIRY_SECONDS = 300; // long enough for a slow connection on a large video, short enough not to linger

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
  image: { maxSizeBytes: 10 * 1024 * 1024, isAllowed: ({ mimeType }) => mimeType.startsWith('image/') },
  audio: { maxSizeBytes: 20 * 1024 * 1024, isAllowed: ({ mimeType }) => mimeType.startsWith('audio/') },
  voice_note: { maxSizeBytes: 8 * 1024 * 1024, isAllowed: ({ mimeType }) => mimeType.startsWith('audio/') },
  video: { maxSizeBytes: 60 * 1024 * 1024, isAllowed: ({ mimeType }) => mimeType.startsWith('video/') },
  pdf: { maxSizeBytes: 20 * 1024 * 1024, isAllowed: ({ mimeType }) => mimeType === 'application/pdf' },
  file: {
    maxSizeBytes: 30 * 1024 * 1024,
    isAllowed: ({ fileName }) => !DANGEROUS_EXTENSIONS.has(path.extname(fileName).toLowerCase()),
  },
};

/**
 * Validate a client-declared file against the rules for a declared message contentType.
 * The file's bytes are never seen server-side - this is the declared metadata the client
 * will go on to request a presigned upload for.
 * @param {Object} declared - { mimeType, size, fileName }
 * @param {string} contentType
 */
const validateDeclaredFile = ({ mimeType, size, fileName }, contentType) => {
  const rule = CONTENT_TYPE_RULES[contentType];
  if (!rule) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Uploads are not supported for contentType "${contentType}"`);
  }
  if (size > rule.maxSizeBytes) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `File exceeds the maximum size for ${contentType} (${rule.maxSizeBytes} bytes)`
    );
  }
  if (!rule.isAllowed({ mimeType, fileName })) {
    throw new ApiError(httpStatus.BAD_REQUEST, `File type "${mimeType}" is not allowed for contentType "${contentType}"`);
  }
};

/**
 * Generate a presigned PUT URL, signed for the declared mimeType/size so R2 itself rejects
 * a PUT whose actual Content-Type/Content-Length don't match what was validated.
 * @param {string} key
 * @param {string} mimeType
 * @param {number} size
 * @returns {Promise<string>}
 */
const generatePresignedPutUrl = async (key, mimeType, size) =>
  getSignedUrl(
    s3Client,
    new PutObjectCommand({ Bucket: config.r2.bucketName, Key: key, ContentType: mimeType, ContentLength: size }),
    { expiresIn: UPLOAD_URL_EXPIRY_SECONDS }
  );

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
 * Recover the R2 object key from a stored attachment URL (the inverse of the url built in createPresignedUpload)
 * @param {string} url
 * @returns {string}
 */
const extractKeyFromUrl = (url) => url.replace(`${config.r2.publicBaseUrl}/`, '');

/**
 * Validate a declared file against a message contentType and issue a presigned R2 upload for it.
 * The client PUTs the file directly to the returned uploadUrl, then sends `attachment` as-is
 * into POST /conversations/:id/messages - the server never receives the file bytes.
 * @param {string} contentType
 * @param {Object} declared - { mimeType, fileName, size, duration }
 * @param {number} [declared.duration] - seconds, audio/voice_note/video only, passed through as-is
 * @returns {Promise<{uploadUrl: string, expiresIn: number, attachment: {url: string, mimeType: string, size: number, fileName: string, duration: number|undefined}}>}
 */
const createPresignedUpload = async (contentType, { mimeType, fileName, size, duration }) => {
  validateDeclaredFile({ mimeType, size, fileName }, contentType);

  const key = `attachments/${crypto.randomUUID()}${path.extname(fileName)}`;
  // call through module.exports (not the local closure) so tests can mock just the signing call
  const uploadUrl = await module.exports.generatePresignedPutUrl(key, mimeType, size);

  return {
    uploadUrl,
    expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
    attachment: {
      url: `${config.r2.publicBaseUrl}/${key}`,
      mimeType,
      size,
      fileName,
      ...(duration !== undefined && { duration }),
    },
  };
};

module.exports = {
  CONTENT_TYPE_RULES,
  validateDeclaredFile,
  generatePresignedPutUrl,
  deleteObjects,
  extractKeyFromUrl,
  createPresignedUpload,
};
