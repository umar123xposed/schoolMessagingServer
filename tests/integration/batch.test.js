const mongoose = require('mongoose');
const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const config = require('../../src/config/config');
const setupTestDB = require('../utils/setupTestDB');
const { Batch, User, Conversation, Message } = require('../../src/models');
const { uploadService } = require('../../src/services');
const { userOne, agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const { userOneAccessToken, agentAccessToken, superAdminAccessToken } = require('../fixtures/token.fixture');
const { batchFall, batchSpring, insertBatches } = require('../fixtures/batch.fixture');

setupTestDB();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeStudent = (name, batchId) => ({
  _id: mongoose.Types.ObjectId(),
  name,
  phoneNumber: `+1${Math.floor(1000000000 + Math.random() * 8999999999)}`,
  password: 'password1',
  role: 'student',
  batchId,
});

const makeConversation = (studentId) => ({
  _id: mongoose.Types.ObjectId(),
  type: 'student_support',
  studentId,
  createdBy: studentId,
  labels: [],
});

describe('Batch routes', () => {
  beforeEach(() => {
    jest.spyOn(uploadService, 'deleteObjects').mockResolvedValue();
  });

  describe('POST /v1/batches', () => {
    test('should return 201 and create a batch for super_admin', async () => {
      await insertUsers([superAdmin]);

      const res = await request(app)
        .post('/v1/batches')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: '2026-fall' })
        .expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({ id: expect.anything(), name: '2026-fall' });
    });

    test('should return 400 for a duplicate batch name', async () => {
      await insertUsers([superAdmin]);
      await insertBatches([batchFall]);

      await request(app)
        .post('/v1/batches')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: batchFall.name })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 403 for a non-super_admin', async () => {
      await insertUsers([agent]);

      await request(app)
        .post('/v1/batches')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ name: '2026-fall' })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /v1/batches', () => {
    test('should return all batches for super_admin', async () => {
      await insertUsers([superAdmin]);
      await insertBatches([batchFall, batchSpring]);

      const res = await request(app)
        .get('/v1/batches')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
    });
  });

  describe('GET /v1/batches/:batchId', () => {
    test('should return 200 for an existing batch', async () => {
      await insertUsers([superAdmin]);
      await insertBatches([batchFall]);

      const res = await request(app)
        .get(`/v1/batches/${batchFall._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.name).toBe(batchFall.name);
    });

    test('should return 404 for a non-existent batch', async () => {
      await insertUsers([superAdmin]);

      await request(app)
        .get(`/v1/batches/${mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /v1/batches/:batchId', () => {
    test('should rename a batch for super_admin', async () => {
      await insertUsers([superAdmin]);
      await insertBatches([batchFall]);

      const res = await request(app)
        .patch(`/v1/batches/${batchFall._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: '2026-fall-renamed' })
        .expect(httpStatus.OK);

      expect(res.body.name).toBe('2026-fall-renamed');
    });

    test('should return 400 when renaming to an already-taken name', async () => {
      await insertUsers([superAdmin]);
      await insertBatches([batchFall, batchSpring]);

      await request(app)
        .patch(`/v1/batches/${batchFall._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: batchSpring.name })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 403 for a non-super_admin', async () => {
      await insertUsers([agent]);
      await insertBatches([batchFall]);

      await request(app)
        .patch(`/v1/batches/${batchFall._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ name: 'renamed' })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /v1/batches/:batchId/students', () => {
    test('should list only students in the given batch', async () => {
      await insertUsers([superAdmin]);
      await insertBatches([batchFall, batchSpring]);
      const inBatch = makeStudent('In batch', batchFall._id);
      const otherBatch = makeStudent('Other batch', batchSpring._id);
      await insertUsers([inBatch, otherBatch]);

      const res = await request(app)
        .get(`/v1/batches/${batchFall._id}/students`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].id).toBe(inBatch._id.toHexString());
    });
  });

  describe('DELETE /v1/batches/:batchId', () => {
    test('should return 202, then delete the batch, its students, conversations, messages, and R2 attachments', async () => {
      await insertUsers([superAdmin]);
      await insertBatches([batchFall]);
      const student = makeStudent('Student Fall', batchFall._id);
      await insertUsers([student]);
      const conversation = makeConversation(student._id);
      await Conversation.insertMany([conversation]);
      await Message.insertMany([
        {
          _id: mongoose.Types.ObjectId(),
          conversationId: conversation._id,
          senderId: student._id,
          contentType: 'image',
          attachment: {
            url: `${config.r2.publicBaseUrl}/attachments/f1.jpg`,
            mimeType: 'image/jpeg',
            size: 1024,
            fileName: 'f1.jpg',
          },
        },
      ]);

      const res = await request(app)
        .delete(`/v1/batches/${batchFall._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ confirmName: batchFall.name })
        .expect(httpStatus.ACCEPTED);

      expect(res.body.batchName).toBe(batchFall.name);
      expect(['pending', 'running']).toContain(res.body.status);

      await sleep(200);

      expect(await Batch.findById(batchFall._id)).toBeNull();
      expect(await User.findById(student._id)).toBeNull();
      expect(await Conversation.findById(conversation._id)).toBeNull();
      expect(await Message.countDocuments({ conversationId: conversation._id })).toBe(0);
      expect(uploadService.deleteObjects).toHaveBeenCalledWith(expect.arrayContaining(['attachments/f1.jpg']));
    });

    test('should return 400 if confirmName does not match the batch name', async () => {
      await insertUsers([superAdmin]);
      await insertBatches([batchFall]);

      await request(app)
        .delete(`/v1/batches/${batchFall._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ confirmName: 'not-the-right-name' })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 for a non-existent batch', async () => {
      await insertUsers([superAdmin]);

      await request(app)
        .delete(`/v1/batches/${mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ confirmName: 'anything' })
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 403 for a non-super_admin', async () => {
      await insertUsers([agent]);
      await insertBatches([batchFall]);

      await request(app)
        .delete(`/v1/batches/${batchFall._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ confirmName: batchFall.name })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 403 for a student', async () => {
      await insertUsers([userOne]);
      await insertBatches([batchFall]);

      await request(app)
        .delete(`/v1/batches/${batchFall._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ confirmName: batchFall.name })
        .expect(httpStatus.FORBIDDEN);
    });
  });
});
