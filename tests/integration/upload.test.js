const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { uploadService } = require('../../src/services');
const { userOne, insertUsers } = require('../fixtures/user.fixture');
const { userOneAccessToken } = require('../fixtures/token.fixture');
const { studentConversationOne, insertConversations } = require('../fixtures/conversation.fixture');

setupTestDB();

describe('Upload routes', () => {
  beforeEach(() => {
    jest.spyOn(uploadService, 'generatePresignedPutUrl').mockResolvedValue('https://r2.example.com/signed-put-url');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /v1/uploads', () => {
    test('should return 201 with an uploadUrl and attachment for a valid image', async () => {
      await insertUsers([userOne]);

      const res = await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'image', mimeType: 'image/jpeg', fileName: 'photo.jpg', size: 245678 })
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        uploadUrl: 'https://r2.example.com/signed-put-url',
        expiresIn: 300,
        attachment: {
          url: expect.stringContaining('attachments/'),
          mimeType: 'image/jpeg',
          size: 245678,
          fileName: 'photo.jpg',
        },
      });
      expect(uploadService.generatePresignedPutUrl).toHaveBeenCalledTimes(1);
    });

    test('should pass through duration for a voice note', async () => {
      await insertUsers([userOne]);

      const res = await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'voice_note', mimeType: 'audio/ogg', fileName: 'note.ogg', size: 1024, duration: 12.5 })
        .expect(httpStatus.CREATED);

      expect(res.body.attachment.duration).toBe(12.5);
    });

    test('should return 400 when the declared mime type does not match the declared contentType', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'image', mimeType: 'application/zip', fileName: 'archive.zip', size: 1024 })
        .expect(httpStatus.BAD_REQUEST);

      expect(uploadService.generatePresignedPutUrl).not.toHaveBeenCalled();
    });

    test('should return 400 when the declared size exceeds the limit for the contentType', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({
          contentType: 'image',
          mimeType: 'image/jpeg',
          fileName: 'photo.jpg',
          size: uploadService.CONTENT_TYPE_RULES.image.maxSizeBytes + 1,
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(uploadService.generatePresignedPutUrl).not.toHaveBeenCalled();
    });

    test('should return 400 when a required field is missing', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'image', mimeType: 'image/jpeg' })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 for an invalid contentType', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'not-a-real-type', mimeType: 'image/jpeg', fileName: 'photo.jpg', size: 1024 })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .post('/v1/uploads')
        .send({ contentType: 'image', mimeType: 'image/jpeg', fileName: 'photo.jpg', size: 1024 })
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('upload -> message seam', () => {
    test('should let a presigned attachment be sent straight into a message with no translation', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);

      const uploadRes = await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'image', mimeType: 'image/jpeg', fileName: 'photo.jpg', size: 245678 })
        .expect(httpStatus.CREATED);

      const messageRes = await request(app)
        .post(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'image', attachment: uploadRes.body.attachment })
        .expect(httpStatus.CREATED);

      expect(messageRes.body[0].attachment).toMatchObject(uploadRes.body.attachment);
    });

    test('should carry duration through from upload into the saved message for a voice note', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);

      const uploadRes = await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'voice_note', mimeType: 'audio/ogg', fileName: 'note.ogg', size: 1024, duration: 7.2 })
        .expect(httpStatus.CREATED);

      expect(uploadRes.body.attachment.duration).toBe(7.2);

      const messageRes = await request(app)
        .post(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'voice_note', attachment: uploadRes.body.attachment })
        .expect(httpStatus.CREATED);

      expect(messageRes.body[0].attachment.duration).toBe(7.2);
    });
  });
});
