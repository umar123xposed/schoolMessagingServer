const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const { jwtVerify } = require('../config/passport');
const { Conversation } = require('../models');
const conversationService = require('../services/conversation.service');
const userService = require('../services/user.service');
const appEvents = require('../utils/appEvents');
const catchSocketAsync = require('../utils/catchSocketAsync');

const AGENTS_INBOX_ROOM = 'agents-inbox';
const conversationRoom = (conversationId) => `conversation:${conversationId}`;

// userId (string) -> Set<Socket> - tracks live connections for presence and for
// joining/leaving rooms on already-connected sockets when group membership changes.
// Single-process only, no Redis - matches the single-VPS Phase 1 deployment target.
const connections = new Map();

const registerConnection = (userId, socket) => {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  const sockets = connections.get(userId);
  const isFirstConnection = sockets.size === 0;
  sockets.add(socket);
  return isFirstConnection;
};

const unregisterConnection = (userId, socket) => {
  const sockets = connections.get(userId);
  if (!sockets) {
    return true;
  }
  sockets.delete(socket);
  const isLastConnection = sockets.size === 0;
  if (isLastConnection) {
    connections.delete(userId);
  }
  return isLastConnection;
};

const getSocketsForUser = (userId) => Array.from(connections.get(userId) || []);

const isStaffRole = (role) => role === 'agent' || role === 'super_admin';

/**
 * Update a user's presence fields, tolerating the account having been deleted in the
 * meantime (e.g. a super_admin offboards an agent while their socket is still open) -
 * that's an expected race in a live system, not something to error/log-spam over.
 */
const updateUserPresence = async (userId, updateBody) => {
  try {
    await userService.updateUserById(userId, updateBody);
  } catch (error) {
    if (error.statusCode !== httpStatus.NOT_FOUND) {
      throw error;
    }
  }
};

const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Please authenticate'));
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return next(new Error('Please authenticate'));
  }

  jwtVerify(payload, (error, user) => {
    if (error || !user) {
      return next(new Error('Please authenticate'));
    }
    // eslint-disable-next-line no-param-reassign
    socket.user = user;
    next();
  });
};

const handleTyping = async (socket, event, payload) => {
  const conversationId = payload && payload.conversationId;
  if (!conversationId) {
    return;
  }

  // Reuse the exact same authorization check REST message routes use, rather than a
  // room-membership heuristic - agents deliberately don't join every individual
  // student_support room (they rely on agents-inbox), so membership alone can't tell
  // us whether an agent is allowed to signal typing into a given student's conversation.
  let conversation;
  try {
    conversation = await conversationService.getConversationAndVerifyAccess(conversationId, socket.user);
  } catch (error) {
    return;
  }

  const relayPayload = { conversationId, userId: String(socket.user._id) };
  socket.to(conversationRoom(conversationId)).emit(event, relayPayload);
  if (conversation.type === 'student_support') {
    socket.to(AGENTS_INBOX_ROOM).emit(event, relayPayload);
  }
};

const handleDisconnect = async (io, socket) => {
  const userId = String(socket.user._id);
  const isLastConnection = unregisterConnection(userId, socket);
  if (isStaffRole(socket.user.role) && isLastConnection) {
    const lastSeenAt = new Date();
    await updateUserPresence(userId, { isOnline: false, lastSeenAt });
    io.to(AGENTS_INBOX_ROOM).emit('presence:update', { userId, isOnline: false, lastSeenAt });
  }
};

const handleConnection = async (io, socket) => {
  const { user } = socket;
  const userId = String(user._id);

  if (isStaffRole(user.role)) {
    socket.join(AGENTS_INBOX_ROOM);
    const { results: groupConversations } = await conversationService.queryConversationsForUser(
      user,
      { type: 'agent_group' },
      { limit: 200 }
    );
    groupConversations.forEach((conversation) => socket.join(conversationRoom(conversation.id)));
  } else {
    const { results: studentConversations } = await conversationService.queryConversationsForUser(
      user,
      { type: 'student_support' },
      { limit: 10 }
    );
    studentConversations.forEach((conversation) => socket.join(conversationRoom(conversation.id)));
  }

  const isFirstConnection = registerConnection(userId, socket);
  if (isStaffRole(user.role) && isFirstConnection) {
    await updateUserPresence(userId, { isOnline: true });
    io.to(AGENTS_INBOX_ROOM).emit('presence:update', { userId, isOnline: true });
  }

  socket.on(
    'typing:start',
    catchSocketAsync(socket, (payload) => handleTyping(socket, 'typing:start', payload))
  );
  socket.on(
    'typing:stop',
    catchSocketAsync(socket, (payload) => handleTyping(socket, 'typing:stop', payload))
  );

  socket.on('disconnect', () => {
    handleDisconnect(io, socket).catch((error) => logger.error(error));
  });

  // room joins above are async (a DB query happens before socket.join()), so the client's
  // own 'connect' event firing does NOT mean the server has finished setting the socket up -
  // another client emitting into a room in that window would find no one there yet. Clients
  // (and tests) should wait for this before assuming they'll receive room-scoped events.
  socket.emit('ready');
};

const broadcastMessageEvent = async (io, event, message) => {
  const conversation = await Conversation.findById(message.conversationId, 'type');
  if (!conversation) {
    return;
  }
  io.to(conversationRoom(message.conversationId)).emit(event, message);
  if (conversation.type === 'student_support') {
    io.to(AGENTS_INBOX_ROOM).emit(event, message);
  }
};

const subscribeToAppEvents = (io) => {
  ['message:new', 'message:pinned', 'message:deleted'].forEach((event) => {
    appEvents.on(event, (message) => {
      broadcastMessageEvent(io, event, message).catch((error) => logger.error(error));
    });
  });

  appEvents.on('conversation:new', (conversation) => {
    io.to(AGENTS_INBOX_ROOM).emit('conversation:new', conversation);
  });

  appEvents.on('conversation:group:created', (conversation) => {
    conversation.participantIds.forEach((participantId) => {
      getSocketsForUser(String(participantId)).forEach((socket) => socket.join(conversationRoom(conversation.id)));
    });
    io.to(conversationRoom(conversation.id)).emit('conversation:group:created', conversation);
  });

  appEvents.on('conversation:group:updated', ({ conversation, previousParticipantIds }) => {
    const currentParticipantIds = conversation.participantIds.map((id) => String(id));
    const added = currentParticipantIds.filter((id) => !previousParticipantIds.includes(id));
    const removed = previousParticipantIds.filter((id) => !currentParticipantIds.includes(id));

    added.forEach((participantId) => {
      getSocketsForUser(participantId).forEach((socket) => socket.join(conversationRoom(conversation.id)));
    });
    removed.forEach((participantId) => {
      getSocketsForUser(participantId).forEach((socket) => socket.leave(conversationRoom(conversation.id)));
    });

    io.to(conversationRoom(conversation.id)).emit('conversation:group:updated', conversation);
  });

  appEvents.on('conversation:group:deleted', (conversation) => {
    const room = conversationRoom(conversation.id);
    io.to(room).emit('conversation:group:deleted', { id: conversation.id });
    io.in(room).socketsLeave(room);
  });
};

/**
 * Attach Socket.io to an existing http.Server
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    handleConnection(io, socket).catch((error) => {
      logger.error(error);
      socket.disconnect(true);
    });
  });

  subscribeToAppEvents(io);

  return io;
};

module.exports = initSocket;
