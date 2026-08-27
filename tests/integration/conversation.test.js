const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { Conversation } = require('../../src/models');
const { userOne, userTwo, agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const { userOneAccessToken, agentAccessToken, superAdminAccessToken } = require('../fixtures/token.fixture');
const {
  studentConversationOne,
  studentConversationTwo,
  groupConversation,
  insertConversations,
} = require('../fixtures/conversation.fixture');
const { urgentLabel, insertLabels } = require('../fixtures/label.fixture');

setupTestDB();

describe('Conversation routes', () => {
  describe('GET /v1/conversations', () => {
    test('should return only the student own conversation', async () => {
      await insertUsers([userOne, userTwo]);
      await insertConversations([studentConversationOne, studentConversationTwo]);

      const res = await request(app)
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].id).toBe(studentConversationOne._id.toHexString());
    });

    test('should return every student_support conversation plus only the agent_group conversations the agent participates in', async () => {
      await insertUsers([userOne, userTwo, agent, superAdmin]);
      await insertConversations([studentConversationOne, studentConversationTwo, groupConversation]);

      const res = await request(app)
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      const ids = res.body.results.map((conversation) => conversation.id);
      expect(ids).toHaveLength(3);
      expect(ids).toEqual(
        expect.arrayContaining([
          studentConversationOne._id.toHexString(),
          studentConversationTwo._id.toHexString(),
          groupConversation._id.toHexString(),
        ])
      );
    });

    test('should return 401 if access token is missing', async () => {
      await request(app).get('/v1/conversations').send().expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/conversations/:id', () => {
    test('should return 403 if a student tries to access another student conversation', async () => {
      await insertUsers([userOne, userTwo]);
      await insertConversations([studentConversationOne, studentConversationTwo]);

      await request(app)
        .get(`/v1/conversations/${studentConversationTwo._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 403 if an agent tries to access a group they do not participate in', async () => {
      await insertUsers([agent, superAdmin]);
      const otherGroup = { ...groupConversation, _id: undefined, participantIds: [superAdmin._id] };
      const created = await Conversation.create(otherGroup);

      await request(app)
        .get(`/v1/conversations/${created._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 for a student accessing their own conversation', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);

      await request(app)
        .get(`/v1/conversations/${studentConversationOne._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send()
        .expect(httpStatus.OK);
    });
  });

  describe('POST /v1/conversations', () => {
    test('should return 201 and create a group chat when super_admin', async () => {
      await insertUsers([agent, superAdmin]);

      const res = await request(app)
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: 'Front desk team', participantIds: [agent._id] })
        .expect(httpStatus.CREATED);

      expect(res.body.type).toBe('agent_group');
      expect(res.body.name).toBe('Front desk team');
      // the creating super_admin must be auto-added as a participant, or they'd be
      // locked out of a group chat they just created (agent_group access is participant-gated)
      expect(res.body.participantIds).toEqual(
        expect.arrayContaining([agent._id.toHexString(), superAdmin._id.toHexString()])
      );
    });

    test('should let the creating super_admin read the group chat they just created', async () => {
      await insertUsers([agent, superAdmin]);

      const createRes = await request(app)
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: 'Front desk team', participantIds: [agent._id] })
        .expect(httpStatus.CREATED);

      await request(app)
        .get(`/v1/conversations/${createRes.body.id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.OK);
    });

    test('should return 403 if an agent tries to create a group chat', async () => {
      await insertUsers([agent]);

      await request(app)
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ name: 'Front desk team', participantIds: [agent._id] })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /v1/conversations/:id', () => {
    test('should return 200 and update a group chat when super_admin', async () => {
      await insertUsers([agent, superAdmin]);
      await insertConversations([groupConversation]);

      const res = await request(app)
        .patch(`/v1/conversations/${groupConversation._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: 'Renamed team' })
        .expect(httpStatus.OK);

      expect(res.body.name).toBe('Renamed team');
    });

    test('should return 400 when trying to update a student_support conversation as a group', async () => {
      await insertUsers([userOne, superAdmin]);
      await insertConversations([studentConversationOne]);

      await request(app)
        .patch(`/v1/conversations/${studentConversationOne._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: 'Not a group' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('PATCH /v1/conversations/:id/labels', () => {
    test('should return 200 and set labels on a student conversation as an agent', async () => {
      await insertUsers([userOne, agent]);
      await insertConversations([studentConversationOne]);
      await insertLabels([urgentLabel]);

      const res = await request(app)
        .patch(`/v1/conversations/${studentConversationOne._id}/labels`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ labels: [urgentLabel._id] })
        .expect(httpStatus.OK);

      expect(res.body.labels).toEqual([urgentLabel._id.toHexString()]);
    });

    test('should return 403 if a student tries to set labels', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);

      await request(app)
        .patch(`/v1/conversations/${studentConversationOne._id}/labels`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ labels: [] })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('DELETE /v1/conversations/:id', () => {
    test('should return 204 and delete a group chat when super_admin', async () => {
      await insertUsers([agent, superAdmin]);
      await insertConversations([groupConversation]);

      await request(app)
        .delete(`/v1/conversations/${groupConversation._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbConversation = await Conversation.findById(groupConversation._id);
      expect(dbConversation).toBeNull();
    });

    test('should return 400 when trying to delete a student_support conversation, even as super_admin', async () => {
      await insertUsers([userOne, superAdmin]);
      await insertConversations([studentConversationOne]);

      await request(app)
        .delete(`/v1/conversations/${studentConversationOne._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);

      const dbConversation = await Conversation.findById(studentConversationOne._id);
      expect(dbConversation).not.toBeNull();
    });

    test('should return 403 if an agent tries to delete a group chat', async () => {
      await insertUsers([agent]);
      await insertConversations([groupConversation]);

      await request(app)
        .delete(`/v1/conversations/${groupConversation._id}`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });
  });
});
