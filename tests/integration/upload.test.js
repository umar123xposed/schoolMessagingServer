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
    jest.spyOn(uploadService, 'putObject').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /v1/uploads', () => {
    test('should return 201 and the attachment object for a valid image', async () => {
      await insertUsers([userOne]);

      const res = await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .field('contentType', 'image')
        .attach('file', Buffer.from('fake image bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        url: expect.stringContaining('attachments/'),
        mimeType: 'image/jpeg',
        size: expect.any(Number),
        fileName: 'photo.jpg',
      });
      expect(uploadService.putObject).toHaveBeenCalledTimes(1);
    });

    test('should return 400 when the file mime type does not match the declared contentType', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .field('contentType', 'image')
        .attach('file', Buffer.from('not an image'), { filename: 'archive.zip', contentType: 'application/zip' })
        .expect(httpStatus.BAD_REQUEST);

      expect(uploadService.putObject).not.toHaveBeenCalled();
    });

    test('should return 400 when the file is missing', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .field('contentType', 'image')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 for an invalid contentType', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .field('contentType', 'not-a-real-type')
        .attach('file', Buffer.from('bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .post('/v1/uploads')
        .field('contentType', 'image')
        .attach('file', Buffer.from('bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('upload -> message seam', () => {
    test('should let an uploaded attachment be sent straight into a message with no translation', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);

      const uploadRes = await request(app)
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .field('contentType', 'image')
        .attach('file', Buffer.from('fake image bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })
        .expect(httpStatus.CREATED);

      const messageRes = await request(app)
        .post(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'image', attachment: uploadRes.body })
        .expect(httpStatus.CREATED);

      expect(messageRes.body[0].attachment).toMatchObject(uploadRes.body);
    });
  });
});
