const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { Message } = require('../../src/models');
const { userOne, userTwo, agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const {
  userOneAccessToken,
  userTwoAccessToken,
  agentAccessToken,
  superAdminAccessToken,
} = require('../fixtures/token.fixture');
const { studentConversationOne, studentConversationTwo, insertConversations } = require('../fixtures/conversation.fixture');
const { textMessageOne, agentReplyOne, insertMessages } = require('../fixtures/message.fixture');

setupTestDB();

describe('Message routes', () => {
  describe('POST /v1/conversations/:id/messages', () => {
    test('should return 201 when a student sends a message into their own conversation', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);

      const res = await request(app)
        .post(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'text', text: 'Hi, I need help' })
        .expect(httpStatus.CREATED);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].text).toBe('Hi, I need help');
      expect(res.body[0].senderId).toBe(userOne._id.toHexString());
    });

    test('should return 403 when a student sends a message into another student conversation', async () => {
      await insertUsers([userOne, userTwo]);
      await insertConversations([studentConversationOne, studentConversationTwo]);

      await request(app)
        .post(`/v1/conversations/${studentConversationTwo._id}/messages`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'text', text: 'Hi' })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 201 when an agent sends a message into any student conversation', async () => {
      await insertUsers([userOne, agent]);
      await insertConversations([studentConversationOne]);

      await request(app)
        .post(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ contentType: 'text', text: 'How can I help?' })
        .expect(httpStatus.CREATED);
    });

    test('should support sending multiple messages in one go', async () => {
      await insertUsers([userOne, agent]);
      await insertConversations([studentConversationOne]);

      const res = await request(app)
        .post(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send([
          { contentType: 'text', text: 'First message' },
          { contentType: 'text', text: 'Second message' },
        ])
        .expect(httpStatus.CREATED);

      expect(res.body).toHaveLength(2);
    });

    test('should return 400 if contentType is text but text is missing', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);

      await request(app)
        .post(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'text' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /v1/conversations/:id/messages', () => {
    test('should return the message history for a conversation the user can access', async () => {
      await insertUsers([userOne, agent]);
      await insertConversations([studentConversationOne]);
      await insertMessages([textMessageOne, agentReplyOne]);

      const res = await request(app)
        .get(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
    });

    test('should return 403 if a student tries to read another student conversation', async () => {
      await insertUsers([userOne, userTwo]);
      await insertConversations([studentConversationOne, studentConversationTwo]);
      await insertMessages([textMessageOne]);

      await request(app)
        .get(`/v1/conversations/${studentConversationOne._id}/messages`)
        .set('Authorization', `Bearer ${userTwoAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /v1/messages/:id/pin', () => {
    test('should return 200 and pin a message when super_admin', async () => {
      await insertUsers([userOne, superAdmin]);
      await insertConversations([studentConversationOne]);
      await insertMessages([textMessageOne]);

      const res = await request(app)
        .patch(`/v1/messages/${textMessageOne._id}/pin`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ isPinned: true })
        .expect(httpStatus.OK);

      expect(res.body.isPinned).toBe(true);
    });

    test('should return 403 if an agent tries to pin a message', async () => {
      await insertUsers([userOne, agent]);
      await insertConversations([studentConversationOne]);
      await insertMessages([textMessageOne]);

      await request(app)
        .patch(`/v1/messages/${textMessageOne._id}/pin`)
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ isPinned: true })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('DELETE /v1/messages/:id', () => {
    test('should return 204 when the sender deletes their own message', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);
      await insertMessages([textMessageOne]);

      await request(app)
        .delete(`/v1/messages/${textMessageOne._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbMessage = await Message.findById(textMessageOne._id);
      expect(dbMessage.isDeleted).toBe(true);
    });

    test('should return 403 when a different student tries to delete a message they did not send', async () => {
      await insertUsers([userOne, userTwo]);
      await insertConversations([studentConversationOne]);
      await insertMessages([textMessageOne]);

      await request(app)
        .delete(`/v1/messages/${textMessageOne._id}`)
        .set('Authorization', `Bearer ${userTwoAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 204 when super_admin deletes any message', async () => {
      await insertUsers([userOne, superAdmin]);
      await insertConversations([studentConversationOne]);
      await insertMessages([textMessageOne]);

      await request(app)
        .delete(`/v1/messages/${textMessageOne._id}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
    });
  });

  describe('POST /v1/messages/broadcast', () => {
    test('should return 201 and create one message per student conversation, sharing one broadcastGroupId, when toAll is set', async () => {
      await insertUsers([userOne, userTwo, agent]);
      await insertConversations([studentConversationOne, studentConversationTwo]);

      const res = await request(app)
        .post('/v1/messages/broadcast')
        .set('Authorization', `Bearer ${agentAccessToken}`)
        .send({ contentType: 'text', text: 'School closed tomorrow', toAll: true })
        .expect(httpStatus.CREATED);

      expect(res.body).toHaveLength(2);
      const broadcastGroupIds = new Set(res.body.map((message) => message.broadcastGroupId));
      expect(broadcastGroupIds.size).toBe(1);
      expect(res.body.every((message) => message.isBroadcast)).toBe(true);
    });

    test('should return 403 if a student tries to broadcast', async () => {
      await insertUsers([userOne]);
      await insertConversations([studentConversationOne]);

      await request(app)
        .post('/v1/messages/broadcast')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ contentType: 'text', text: 'Hi everyone', toAll: true })
        .expect(httpStatus.FORBIDDEN);
    });
  });
});
