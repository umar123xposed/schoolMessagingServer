const mongoose = require('mongoose');
const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { Conversation, Message, BatchDeletionJob } = require('../../src/models');
const { uploadService } = require('../../src/services');
const { userOne, agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const { userOneAccessToken, agentAccessToken, superAdminAccessToken } = require('../fixtures/token.fixture');

setupTestDB();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeStudent = (batchLabel) => ({
  _id: mongoose.Types.ObjectId(),
  name: `Student ${batchLabel}`,
  phoneNumber: `+1${Math.floor(1000000000 + Math.random() * 8999999999)}`,
  password: 'password1',
  role: 'student',
  batchLabel,
});

const makeConversation = (studentId) => ({
  _id: mongoose.Types.ObjectId(),
  type: 'student_support',
  studentId,
  createdBy: studentId,
  labels: [],
});

describe('Admin routes', () => {
  beforeEach(() => {
    jest.spyOn(uploadService, 'deleteObjects').mockResolvedValue();
  });

  describe('GET /v1/admin/storage-stats', () => {
    test('should return 200 with a per-batch breakdown for super_admin', async () => {
      await insertUsers([superAdmin]);
      const student = makeStudent('batch-X');
      await insertUsers([student]);
      const conversation = makeConversation(student._id);
      await Conversation.insertMany([conversation]);
      await Message.insertMany([
        {
          _id: mongoose.Types.ObjectId(),
          conversationId: conversation._id,
          senderId: student._id,
          contentType: 'text',
          text: 'hi',
        },
      ]);

      const res = await request(app)
        .get('/v1/admin/storage-stats')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      const batchStats = res.body.batches.find((b) => b.batchLabel === 'batch-X');
      expect(batchStats).toMatchObject({ studentCount: 1, conversationCount: 1, messageCount: 1 });
      expect(res.body.total.studentCount).toBeGreaterThanOrEqual(1);
    });

    test('should return 403 for a non-super_admin', async () => {
      await insertUsers([agent]);

      await request(app)
        .get('/v1/admin/storage-stats')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 401 if unauthenticated', async () => {
      await request(app).get('/v1/admin/storage-stats').send().expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/admin/batches/:batchLabel/delete', () => {
    test('should return 202 immediately with a pending/running job, without blocking on the deletion work', async () => {
      await insertUsers([superAdmin]);
      const student = makeStudent('batch-Y');
      await insertUsers([student]);

      const res = await request(app)
        .post('/v1/admin/batches/batch-Y/delete')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ confirmBatchLabel: 'batch-Y' })
        .expect(httpStatus.ACCEPTED);

      expect(res.body.batchLabel).toBe('batch-Y');
      expect(['pending', 'running']).toContain(res.body.status);

      // let the background job finish before the next test's DB wipe, for tidiness
      await sleep(200);
    });

    test('should return 400 if confirmBatchLabel does not match the batchLabel param', async () => {
      await insertUsers([superAdmin]);

      await request(app)
        .post('/v1/admin/batches/batch-Y/delete')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ confirmBatchLabel: 'not-the-right-label' })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 403 for a non-super_admin', async () => {
      await insertUsers([agent]);

      await request(app)
        .post('/v1/admin/batches/batch-Y/delete')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ confirmBatchLabel: 'batch-Y' })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 403 for a student', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/admin/batches/batch-Y/delete')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ confirmBatchLabel: 'batch-Y' })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /v1/admin/batch-deletions/:id', () => {
    test('should return 200 with the job status', async () => {
      await insertUsers([superAdmin]);
      const job = await BatchDeletionJob.create({ batchLabel: 'batch-Z', triggeredBy: superAdmin._id });

      const res = await request(app)
        .get(`/v1/admin/batch-deletions/${job.id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.batchLabel).toBe('batch-Z');
    });

    test('should return 404 if the job does not exist', async () => {
      await insertUsers([superAdmin]);

      await request(app)
        .get(`/v1/admin/batch-deletions/${mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('GET /v1/admin/batch-deletions', () => {
    test('should list jobs, filterable by status', async () => {
      await insertUsers([superAdmin]);
      await BatchDeletionJob.insertMany([
        { batchLabel: 'batch-1', triggeredBy: superAdmin._id, status: 'completed' },
        { batchLabel: 'batch-2', triggeredBy: superAdmin._id, status: 'failed' },
      ]);

      const res = await request(app)
        .get('/v1/admin/batch-deletions')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .query({ status: 'failed' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].batchLabel).toBe('batch-2');
    });
  });
});
