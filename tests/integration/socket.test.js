const http = require('http');
const request = require('supertest');
const httpStatus = require('http-status');
const { io: ioClient } = require('socket.io-client');
const app = require('../../src/app');
const initSocket = require('../../src/socket');
const setupTestDB = require('../utils/setupTestDB');
const { User } = require('../../src/models');
const { userOne, userTwo, agent, superAdmin, insertUsers } = require('../fixtures/user.fixture');
const {
  userOneAccessToken,
  userTwoAccessToken,
  agentAccessToken,
  superAdminAccessToken,
} = require('../fixtures/token.fixture');
const { studentConversationOne, studentConversationTwo, insertConversations } = require('../fixtures/conversation.fixture');

setupTestDB();

let httpServer;
let baseURL;
let clients;

beforeAll(async () => {
  httpServer = http.createServer(app);
  initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(resolve));
  baseURL = `http://localhost:${httpServer.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
});

beforeEach(() => {
  clients = [];
});

afterEach(async () => {
  clients.forEach((client) => client.disconnect());
  // let the server finish any async disconnect handling (presence DB write) before the
  // next test's setupTestDB() beforeEach wipes the collections out from under it
  await new Promise((resolve) => setTimeout(resolve, 150));
});

const connectClient = (token) => {
  const client = ioClient(baseURL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  clients.push(client);
  return client;
};

// Waits for the server's 'ready' event, not the client's own 'connect' - room-joining on
// the server is async (a DB query happens before socket.join()), so 'connect' firing does
// not mean the server has finished setting the socket up yet. See src/socket/index.js.
const waitForConnect = (client, timeout = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting to connect')), timeout);
    client.once('ready', () => {
      clearTimeout(timer);
      resolve();
    });
    client.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

const waitForEvent = (client, event, timeout = 2000, predicate = () => true) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    const listener = (payload) => {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      client.off(event, listener);
      resolve(payload);
    };
    client.on(event, listener);
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendMessage = (token, conversationId, text) =>
  request(app)
    .post(`/v1/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send({ contentType: 'text', text })
    .expect(httpStatus.CREATED);

describe('Socket.io', () => {
  describe('auth', () => {
    test('rejects a connection with no token', async () => {
      const client = connectClient(undefined);
      await expect(waitForConnect(client)).rejects.toThrow();
    });

    test('rejects a connection with an invalid token', async () => {
      const client = connectClient('not-a-real-token');
      await expect(waitForConnect(client)).rejects.toThrow();
    });

    test('accepts a connection with a valid access token', async () => {
      await insertUsers([userOne]);
      const client = connectClient(userOneAccessToken);
      await expect(waitForConnect(client)).resolves.toBeUndefined();
    });
  });

  describe('message delivery', () => {
    test('a student only receives message:new for their own conversation', async () => {
      await insertUsers([userOne, userTwo]);
      await insertConversations([studentConversationOne, studentConversationTwo]);

      const client = connectClient(userOneAccessToken);
      await waitForConnect(client);

      const received = [];
      client.on('message:new', (message) => received.push(message));

      await sendMessage(userTwoAccessToken, studentConversationTwo._id, 'not for you');
      await sendMessage(userOneAccessToken, studentConversationOne._id, 'for me');

      await sleep(300);

      expect(received).toHaveLength(1);
      expect(received[0].text).toBe('for me');
    });

    test('an agent receives message:new for any student conversation via agents-inbox', async () => {
      await insertUsers([userOne, agent]);
      await insertConversations([studentConversationOne]);

      const client = connectClient(agentAccessToken);
      await waitForConnect(client);

      const eventPromise = waitForEvent(client, 'message:new');
      await sendMessage(userOneAccessToken, studentConversationOne._id, 'hi there');

      const message = await eventPromise;
      expect(message.text).toBe('hi there');
    });
  });

  describe('pin / delete', () => {
    test('pinning and deleting a message broadcast the right events', async () => {
      await insertUsers([userOne, superAdmin]);
      await insertConversations([studentConversationOne]);

      const client = connectClient(userOneAccessToken);
      await waitForConnect(client);

      const sendRes = await sendMessage(userOneAccessToken, studentConversationOne._id, 'pin me');
      const messageId = sendRes.body[0].id;

      const pinnedPromise = waitForEvent(client, 'message:pinned');
      await request(app)
        .patch(`/v1/messages/${messageId}/pin`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ isPinned: true })
        .expect(httpStatus.OK);
      const pinned = await pinnedPromise;
      expect(pinned.isPinned).toBe(true);

      const deletedPromise = waitForEvent(client, 'message:deleted');
      await request(app)
        .delete(`/v1/messages/${messageId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
      const deleted = await deletedPromise;
      expect(deleted.isDeleted).toBe(true);
    });
  });

  describe('typing indicators', () => {
    test('relays to the other party but not back to the sender, and reaches agents-inbox', async () => {
      await insertUsers([userOne, agent]);
      await insertConversations([studentConversationOne]);

      const studentClient = connectClient(userOneAccessToken);
      const agentClient = connectClient(agentAccessToken);
      await Promise.all([waitForConnect(studentClient), waitForConnect(agentClient)]);

      const selfReceived = [];
      studentClient.on('typing:start', (payload) => selfReceived.push(payload));
      const agentEventPromise = waitForEvent(agentClient, 'typing:start');

      studentClient.emit('typing:start', { conversationId: studentConversationOne._id.toString() });

      const agentPayload = await agentEventPromise;
      expect(agentPayload).toMatchObject({
        conversationId: studentConversationOne._id.toString(),
        userId: userOne._id.toString(),
      });

      await sleep(200);
      expect(selfReceived).toHaveLength(0);
    });

    test('an agent can signal typing into a student conversation even though they are not individually room-joined to it', async () => {
      await insertUsers([userOne, agent]);
      await insertConversations([studentConversationOne]);

      const studentClient = connectClient(userOneAccessToken);
      const agentClient = connectClient(agentAccessToken);
      await Promise.all([waitForConnect(studentClient), waitForConnect(agentClient)]);

      const studentEventPromise = waitForEvent(studentClient, 'typing:start');
      agentClient.emit('typing:start', { conversationId: studentConversationOne._id.toString() });

      const payload = await studentEventPromise;
      expect(payload.userId).toBe(agent._id.toString());
    });
  });

  describe('presence', () => {
    test("an agent's isOnline flips true on connect and false with lastSeenAt on last disconnect", async () => {
      await insertUsers([agent, superAdmin]);

      const observer = connectClient(superAdminAccessToken);
      await waitForConnect(observer);

      const agentId = agent._id.toString();
      const onlinePromise = waitForEvent(observer, 'presence:update', 2000, (payload) => payload.userId === agentId);
      const agentClient = connectClient(agentAccessToken);
      await waitForConnect(agentClient);

      const onlineEvent = await onlinePromise;
      expect(onlineEvent).toMatchObject({ userId: agentId, isOnline: true });
      expect((await User.findById(agent._id)).isOnline).toBe(true);

      const offlinePromise = waitForEvent(
        observer,
        'presence:update',
        2000,
        (payload) => payload.userId === agentId && payload.isOnline === false
      );
      agentClient.disconnect();
      const offlineEvent = await offlinePromise;

      expect(offlineEvent).toMatchObject({ userId: agent._id.toString(), isOnline: false });
      expect(offlineEvent.lastSeenAt).toBeDefined();
      expect((await User.findById(agent._id)).isOnline).toBe(false);
    });
  });

  describe('group membership sync', () => {
    test('adding a participant to a group live-joins their connected socket to the room', async () => {
      await insertUsers([agent, superAdmin]);

      const agentClient = connectClient(agentAccessToken);
      await waitForConnect(agentClient);

      const createRes = await request(app)
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ name: 'Staff room', participantIds: [superAdmin._id] })
        .expect(httpStatus.CREATED);
      const groupId = createRes.body.id;

      const updatedPromise = waitForEvent(agentClient, 'conversation:group:updated');
      await request(app)
        .patch(`/v1/conversations/${groupId}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({ participantIds: [agent._id, superAdmin._id] })
        .expect(httpStatus.OK);
      await updatedPromise;

      const messagePromise = waitForEvent(agentClient, 'message:new');
      await sendMessage(superAdminAccessToken, groupId, 'welcome to the group');
      const message = await messagePromise;
      expect(message.text).toBe('welcome to the group');
    });
  });
});
