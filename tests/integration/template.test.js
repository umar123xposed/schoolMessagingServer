const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { Template } = require('../../src/models');
const { userOne, agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const { userOneAccessToken, agentAccessToken, superAdminAccessToken } = require('../fixtures/token.fixture');
const { sharedTemplateOne, privateTemplateOne, insertTemplates } = require('../fixtures/template.fixture');

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
      expect(res.body.isShared).toBe(false);
    });

    test('should return 403 if a student tries to create a template', async () => {
      await insertUsers([userOne]);

      await request(app)
        .post('/v1/templates')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ shortcut: '/1', content: 'Thanks for reaching out!' })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 400 if the shortcut is already taken', async () => {
      await insertUsers([agent]);
      await insertTemplates([sharedTemplateOne]);

      await request(app)
        .post('/v1/templates')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ shortcut: sharedTemplateOne.shortcut, content: 'Another message' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /v1/templates', () => {
    test("should return the current agent's own templates plus every shared template", async () => {
      await insertUsers([agent, superAdmin]);
      await insertTemplates([sharedTemplateOne, privateTemplateOne]);

      const res = await request(app)
        .get('/v1/templates')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      const shortcuts = res.body.results.map((template) => template.shortcut);
      expect(shortcuts).toEqual([sharedTemplateOne.shortcut]);
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

  describe('PATCH /v1/templates/:id', () => {
    test('should return 200 when the creator updates their own template', async () => {
      await insertUsers([agent]);
      await insertTemplates([sharedTemplateOne]);

      const res = await request(app)
        .patch(`/v1/templates/${sharedTemplateOne._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ content: 'Updated content' })
        .expect(httpStatus.OK);

      expect(res.body.content).toBe('Updated content');
    });

    test('should return 200 when super_admin updates a template they did not create', async () => {
      await insertUsers([agent, superAdmin]);
      await insertTemplates([sharedTemplateOne]);

      await request(app)
        .patch(`/v1/templates/${sharedTemplateOne._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ content: 'Curated content' })
        .expect(httpStatus.OK);
    });
  });

  describe('DELETE /v1/templates/:id', () => {
    test('should return 204 when the creator deletes their own template', async () => {
      await insertUsers([agent]);
      await insertTemplates([sharedTemplateOne]);

      await request(app)
        .delete(`/v1/templates/${sharedTemplateOne._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbTemplate = await Template.findById(sharedTemplateOne._id);
      expect(dbTemplate).toBeNull();
    });
  });
});
