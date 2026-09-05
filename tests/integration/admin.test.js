const mongoose = require('mongoose');
const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { Conversation, Message, BatchDeletionJob, Batch } = require('../../src/models');
const { uploadService } = require('../../src/services');
const { agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const { agentAccessToken, superAdminAccessToken } = require('../fixtures/token.fixture');

setupTestDB();

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

describe('Admin routes', () => {
  beforeEach(() => {
    jest.spyOn(uploadService, 'deleteObjects').mockResolvedValue();
  });

  describe('GET /v1/admin/storage-stats', () => {
    test('should return 200 with a per-batch breakdown for super_admin', async () => {
      await insertUsers([superAdmin]);
      const batch = { _id: mongoose.Types.ObjectId(), name: 'batch-X' };
      await Batch.insertMany([batch]);
      const student = makeStudent('Student X', batch._id);
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

      const batchStats = res.body.batches.find((b) => b.batchName === 'batch-X');
      expect(batchStats).toMatchObject({
        batchId: batch._id.toHexString(),
        studentCount: 1,
        conversationCount: 1,
        messageCount: 1,
      });
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

  describe('GET /v1/admin/batch-deletions/:id', () => {
    test('should return 200 with the job status', async () => {
      await insertUsers([superAdmin]);
      const job = await BatchDeletionJob.create({
        batchId: mongoose.Types.ObjectId(),
        batchName: 'batch-Z',
        triggeredBy: superAdmin._id,
      });

      const res = await request(app)
        .get(`/v1/admin/batch-deletions/${job.id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.batchName).toBe('batch-Z');
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
        { batchId: mongoose.Types.ObjectId(), batchName: 'batch-1', triggeredBy: superAdmin._id, status: 'completed' },
        { batchId: mongoose.Types.ObjectId(), batchName: 'batch-2', triggeredBy: superAdmin._id, status: 'failed' },
      ]);

      const res = await request(app)
        .get('/v1/admin/batch-deletions')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .query({ status: 'failed' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].batchName).toBe('batch-2');
    });
  });
});
