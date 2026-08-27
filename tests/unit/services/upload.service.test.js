const httpStatus = require('http-status');
const ApiError = require('../../../src/utils/ApiError');
const { validateFileAgainstContentType, CONTENT_TYPE_RULES } = require('../../../src/services/upload.service');

describe('upload.service', () => {
  describe('validateFileAgainstContentType', () => {
    test('should pass for a valid image within the size limit', () => {
      const file = { size: 1024, mimetype: 'image/png', originalname: 'photo.png' };
      expect(() => validateFileAgainstContentType(file, 'image')).not.toThrow();
    });

    test('should throw a 400 ApiError when the file exceeds the size limit for its contentType', () => {
      const file = { size: CONTENT_TYPE_RULES.image.maxSizeBytes + 1, mimetype: 'image/png', originalname: 'photo.png' };
      let thrownError;
      try {
        validateFileAgainstContentType(file, 'image');
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(ApiError);
      expect(thrownError.statusCode).toBe(httpStatus.BAD_REQUEST);
    });

    test('should throw a 400 ApiError when the mime type does not match the declared contentType', () => {
      const file = { size: 1024, mimetype: 'application/zip', originalname: 'archive.zip' };
      expect(() => validateFileAgainstContentType(file, 'image')).toThrow(ApiError);
    });

    test('should throw for a dangerous extension under the generic file contentType', () => {
      const file = { size: 1024, mimetype: 'application/octet-stream', originalname: 'virus.exe' };
      expect(() => validateFileAgainstContentType(file, 'file')).toThrow(ApiError);
    });

    test('should allow a broad range of file types under the generic file contentType', () => {
      const file = { size: 1024, mimetype: 'application/zip', originalname: 'archive.zip' };
      expect(() => validateFileAgainstContentType(file, 'file')).not.toThrow();
    });

    test('should validate the voice_note rule (small, audio mime)', () => {
      const file = { size: 1024, mimetype: 'audio/ogg', originalname: 'note.ogg' };
      expect(() => validateFileAgainstContentType(file, 'voice_note')).not.toThrow();
      expect(CONTENT_TYPE_RULES.voice_note.maxSizeBytes).toBeLessThan(CONTENT_TYPE_RULES.audio.maxSizeBytes);
    });

    test('should validate the video rule', () => {
      const file = { size: 1024, mimetype: 'video/mp4', originalname: 'clip.mp4' };
      expect(() => validateFileAgainstContentType(file, 'video')).not.toThrow();
    });

    test('should validate the pdf rule', () => {
      const file = { size: 1024, mimetype: 'application/pdf', originalname: 'homework.pdf' };
      expect(() => validateFileAgainstContentType(file, 'pdf')).not.toThrow();
    });

    test('should throw for an unsupported contentType (uploads only cover non-text content)', () => {
      const file = { size: 1, mimetype: 'text/plain', originalname: 'a.txt' };
      expect(() => validateFileAgainstContentType(file, 'text')).toThrow(ApiError);
    });
  });
});
