const httpStatus = require('http-status');
const ApiError = require('../../../src/utils/ApiError');
const uploadService = require('../../../src/services/upload.service');

const { validateDeclaredFile, CONTENT_TYPE_RULES } = uploadService;

describe('upload.service', () => {
  describe('validateDeclaredFile', () => {
    test('should pass for a valid image within the size limit', () => {
      const declared = { size: 1024, mimeType: 'image/png', fileName: 'photo.png' };
      expect(() => validateDeclaredFile(declared, 'image')).not.toThrow();
    });

    test('should throw a 400 ApiError when the declared size exceeds the limit for its contentType', () => {
      const declared = { size: CONTENT_TYPE_RULES.image.maxSizeBytes + 1, mimeType: 'image/png', fileName: 'photo.png' };
      let thrownError;
      try {
        validateDeclaredFile(declared, 'image');
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(ApiError);
      expect(thrownError.statusCode).toBe(httpStatus.BAD_REQUEST);
    });

    test('should throw a 400 ApiError when the mime type does not match the declared contentType', () => {
      const declared = { size: 1024, mimeType: 'application/zip', fileName: 'archive.zip' };
      expect(() => validateDeclaredFile(declared, 'image')).toThrow(ApiError);
    });

    test('should throw for a dangerous extension under the generic file contentType', () => {
      const declared = { size: 1024, mimeType: 'application/octet-stream', fileName: 'virus.exe' };
      expect(() => validateDeclaredFile(declared, 'file')).toThrow(ApiError);
    });

    test('should allow a broad range of file types under the generic file contentType', () => {
      const declared = { size: 1024, mimeType: 'application/zip', fileName: 'archive.zip' };
      expect(() => validateDeclaredFile(declared, 'file')).not.toThrow();
    });

    test('should validate the voice_note rule (small, audio mime)', () => {
      const declared = { size: 1024, mimeType: 'audio/ogg', fileName: 'note.ogg' };
      expect(() => validateDeclaredFile(declared, 'voice_note')).not.toThrow();
      expect(CONTENT_TYPE_RULES.voice_note.maxSizeBytes).toBeLessThan(CONTENT_TYPE_RULES.audio.maxSizeBytes);
    });

    test('should validate the video rule', () => {
      const declared = { size: 1024, mimeType: 'video/mp4', fileName: 'clip.mp4' };
      expect(() => validateDeclaredFile(declared, 'video')).not.toThrow();
    });

    test('should validate the pdf rule', () => {
      const declared = { size: 1024, mimeType: 'application/pdf', fileName: 'homework.pdf' };
      expect(() => validateDeclaredFile(declared, 'pdf')).not.toThrow();
    });

    test('should throw for an unsupported contentType (uploads only cover non-text content)', () => {
      const declared = { size: 1, mimeType: 'text/plain', fileName: 'a.txt' };
      expect(() => validateDeclaredFile(declared, 'text')).toThrow(ApiError);
    });
  });

  describe('createPresignedUpload', () => {
    beforeEach(() => {
      jest.spyOn(uploadService, 'generatePresignedPutUrl').mockResolvedValue('https://r2.example.com/signed-put-url');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return an uploadUrl, expiresIn, and the attachment shape for a valid image', async () => {
      const result = await uploadService.createPresignedUpload('image', {
        mimeType: 'image/jpeg',
        fileName: 'photo.jpg',
        size: 1024,
      });

      expect(result.uploadUrl).toBe('https://r2.example.com/signed-put-url');
      expect(result.expiresIn).toBe(300);
      expect(result.attachment).toEqual({
        url: expect.stringContaining('attachments/'),
        mimeType: 'image/jpeg',
        size: 1024,
        fileName: 'photo.jpg',
      });
      expect(result.attachment.url).toMatch(/\.jpg$/);
    });

    test('should sign the presigned URL with the declared key, mimeType, and size', async () => {
      await uploadService.createPresignedUpload('video', { mimeType: 'video/mp4', fileName: 'clip.mp4', size: 2048 });

      expect(uploadService.generatePresignedPutUrl).toHaveBeenCalledWith(
        expect.stringMatching(/^attachments\/.+\.mp4$/),
        'video/mp4',
        2048
      );
    });

    test('should pass through duration for a voice note', async () => {
      const result = await uploadService.createPresignedUpload('voice_note', {
        mimeType: 'audio/ogg',
        fileName: 'note.ogg',
        size: 1024,
        duration: 7.2,
      });

      expect(result.attachment.duration).toBe(7.2);
    });

    test('should reject before signing when the declared file fails validation', async () => {
      await expect(
        uploadService.createPresignedUpload('image', { mimeType: 'application/zip', fileName: 'archive.zip', size: 1024 })
      ).rejects.toBeInstanceOf(ApiError);
      expect(uploadService.generatePresignedPutUrl).not.toHaveBeenCalled();
    });
  });
});
