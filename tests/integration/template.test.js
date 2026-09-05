const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { Template } = require('../../src/models');
const { userOne, agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const { userOneAccessToken, agentAccessToken, superAdminAccessToken } = require('../fixtures/token.fixture');
const { agentTemplateOne, superAdminTemplateOne, insertTemplates } = require('../fixtures/template.fixture');

setupTestDB();

describe('Template routes', () => {
  describe('POST /v1/templates', () => {
    test('should return 201 and create a template when agent', async () => {
      await insertUsers([agent]);

      const res = await request(app)
        .post('/v1/templates')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ shortcut: '/1', content: 'Thanks for reaching out!' })
        .expect(httpStatus.CREATED);

      expect(res.body.shortcut).toBe('/1');
      expect(res.body).not.toHaveProperty('isShared');
    });

    test('should return 403 if a student tries to create a template', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/templates')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ shortcut: '/1', content: 'Thanks for reaching out!' })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 400 if the same creator reuses a shortcut', async () => {
      await insertUsers([agent]);
      await insertTemplates([agentTemplateOne]);

      await request(app)
        .post('/v1/templates')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ shortcut: agentTemplateOne.shortcut, content: 'Another message' })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should allow a different agent to reuse the same shortcut another agent already has', async () => {
      await insertUsers([agent, superAdmin]);
      await insertTemplates([agentTemplateOne]);

      const res = await request(app)
        .post('/v1/templates')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ shortcut: agentTemplateOne.shortcut, content: 'A different message' })
        .expect(httpStatus.CREATED);

      expect(res.body.shortcut).toBe(agentTemplateOne.shortcut);
    });
  });

  describe('GET /v1/templates', () => {
    test("should return only the current user's own templates, never another user's", async () => {
      await insertUsers([agent, superAdmin]);
      await insertTemplates([agentTemplateOne, superAdminTemplateOne]);

      const res = await request(app)
        .get('/v1/templates')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].id).toBe(agentTemplateOne._id.toHexString());
    });

    test('should return 403 if a student tries to list templates', async () => {
      await insertUsers([userOne]);

      await request(app)
        .get('/v1/templates')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /v1/templates/:id', () => {
    test('should return 200 for the creator', async () => {
      await insertUsers([agent]);
      await insertTemplates([agentTemplateOne]);

      await request(app)
        .get(`/v1/templates/${agentTemplateOne._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.OK);
    });

    test('should return 403 for a different agent, even though the shortcut matches theirs', async () => {
      await insertUsers([agent, superAdmin]);
      await insertTemplates([agentTemplateOne]);

      await request(app)
        .get(`/v1/templates/${agentTemplateOne._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /v1/templates/:id', () => {
    test('should return 200 when the creator updates their own template', async () => {
      await insertUsers([agent]);
      await insertTemplates([agentTemplateOne]);

      const res = await request(app)
        .patch(`/v1/templates/${agentTemplateOne._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ content: 'Updated content' })
        .expect(httpStatus.OK);

      expect(res.body.content).toBe('Updated content');
    });

    test('should return 403 when the super_admin tries to update a template they did not create', async () => {
      await insertUsers([agent, superAdmin]);
      await insertTemplates([agentTemplateOne]);

      await request(app)
        .patch(`/v1/templates/${agentTemplateOne._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ content: 'Curated content' })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('DELETE /v1/templates/:id', () => {
    test('should return 204 when the creator deletes their own template', async () => {
      await insertUsers([agent]);
      await insertTemplates([agentTemplateOne]);

      await request(app)
        .delete(`/v1/templates/${agentTemplateOne._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbTemplate = await Template.findById(agentTemplateOne._id);
      expect(dbTemplate).toBeNull();
    });

    test('should return 403 when a different user tries to delete a template they did not create', async () => {
      await insertUsers([agent, superAdmin]);
      await insertTemplates([agentTemplateOne]);

      await request(app)
        .delete(`/v1/templates/${agentTemplateOne._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);

      const dbTemplate = await Template.findById(agentTemplateOne._id);
      expect(dbTemplate).not.toBeNull();
    });
  });
});
