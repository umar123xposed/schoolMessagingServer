const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { Label } = require('../../src/models');
const { userOne, agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const { userOneAccessToken, agentAccessToken, superAdminAccessToken } = require('../fixtures/token.fixture');
const { urgentLabel, newStudentLabel, insertLabels } = require('../fixtures/label.fixture');

setupTestDB();

describe('Label routes', () => {
  describe('POST /v1/labels', () => {
    test('should return 201 and create a label when agent', async () => {
      await insertUsers([agent]);

      const res = await request(app)
        .post('/v1/labels')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ name: 'urgent', color: '#ff0000' })
        .expect(httpStatus.CREATED);

      expect(res.body.name).toBe('urgent');
    });

    test('should return 403 if a student tries to create a label', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/labels')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ name: 'urgent', color: '#ff0000' })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 400 if the label name is already taken', async () => {
      await insertUsers([agent]);
      await insertLabels([urgentLabel]);

      await request(app)
        .post('/v1/labels')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ name: urgentLabel.name, color: '#00ff00' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /v1/labels', () => {
    test('should return 200 and all labels for any authenticated user', async () => {
      await insertUsers([userOne]);
      await insertLabels([urgentLabel, newStudentLabel]);

      const res = await request(app)
        .get('/v1/labels')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
    });
  });

  describe('PATCH /v1/labels/:id', () => {
    test('should return 200 and update the label when super_admin', async () => {
      await insertUsers([superAdmin]);
      await insertLabels([urgentLabel]);

      const res = await request(app)
        .patch(`/v1/labels/${urgentLabel._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ color: '#123456' })
        .expect(httpStatus.OK);

      expect(res.body.color).toBe('#123456');
    });

    test('should return 403 if a student tries to update a label', async () => {
      await insertUsers([userOne]);
      await insertLabels([urgentLabel]);

      await request(app)
        .patch(`/v1/labels/${urgentLabel._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ color: '#123456' })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('DELETE /v1/labels/:id', () => {
    test('should return 204 and delete the label when agent', async () => {
      await insertUsers([agent]);
      await insertLabels([urgentLabel]);

      await request(app)
        .delete(`/v1/labels/${urgentLabel._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbLabel = await Label.findById(urgentLabel._id);
      expect(dbLabel).toBeNull();
    });
  });
});
