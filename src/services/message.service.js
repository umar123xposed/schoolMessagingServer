const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Message, Conversation } = require('../models');
const ApiError = require('../utils/ApiError');
const appEvents = require('../utils/appEvents');
const conversationService = require('./conversation.service');

/**
 * Send one or more messages into a conversation
 * @param {ObjectId} conversationId
 * @param {User} sender
 * @param {Object|Object[]} messagesInput
 * @returns {Promise<Message[]>}
 */
const sendMessages = async (conversationId, sender, messagesInput) => {
  const conversation = await conversationService.getConversationAndVerifyAccess(conversationId, sender);

  const messageBodies = (Array.isArray(messagesInput) ? messagesInput : [messagesInput]).map((body) => ({
    ...body,
    conversationId,
    senderId: sender._id,
  }));

  const messages = await Message.create(messageBodies);

  conversation.lastMessageAt = new Date();
  await conversation.save();

  messages.forEach((message) => appEvents.emit('message:new', message));

  return messages;
};

/**
 * Query the message history of a conversation
 * @param {ObjectId} conversationId
 * @param {User} user
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const queryMessages = async (conversationId, user, options) => {
  await conversationService.getConversationAndVerifyAccess(conversationId, user);
  return Message.paginate({ conversationId }, options);
};

/**
 * Pin or unpin a message - super_admin only
 * @param {ObjectId} messageId
 * @param {User} user
 * @param {boolean} isPinned
 * @returns {Promise<Message>}
 */
const pinMessage = async (messageId, user, isPinned) => {
  if (user.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
  const message = await Message.findById(messageId);
  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  }
  message.isPinned = isPinned;
  message.pinnedBy = isPinned ? user._id : undefined;
  message.pinnedAt = isPinned ? new Date() : undefined;
  await message.save();
  appEvents.emit('message:pinned', message);
  return message;
};

/**
 * Soft-delete a message - allowed for the original sender or super_admin
 * @param {ObjectId} messageId
 * @param {User} user
 * @returns {Promise<Message>}
 */
const deleteMessage = async (messageId, user) => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  }
  if (String(message.senderId) !== String(user._id) && user.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
  message.isDeleted = true;
  message.deletedAt = new Date();
  await message.save();
  appEvents.emit('message:deleted', message);
  return message;
};

/**
 * Forward/broadcast a message to multiple student conversations, or all of them
 * @param {User} sender
 * @param {Object} body - { contentType, text, attachment, targetConversationIds, toAll }
 * @returns {Promise<Message[]>}
 */
const broadcastMessage = async (sender, body) => {
  if (sender.role !== 'agent' && sender.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }

  const { targetConversationIds, toAll, ...content } = body;

  let targetIds = targetConversationIds;
  if (toAll) {
    const studentConversations = await Conversation.find({ type: 'student_support' }, '_id');
    targetIds = studentConversations.map((conversation) => conversation._id);
  } else {
    const validTargets = await Conversation.find({ _id: { $in: targetIds }, type: 'student_support' }, '_id');
    if (validTargets.length !== targetIds.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'All broadcast targets must be existing student_support conversations');
    }
  }

  const broadcastGroupId = new mongoose.Types.ObjectId();
  const messageBodies = targetIds.map((conversationId) => ({
    ...content,
    conversationId,
    senderId: sender._id,
    isBroadcast: true,
    broadcastGroupId,
  }));

  const messages = await Message.create(messageBodies);
  await Conversation.updateMany({ _id: { $in: targetIds } }, { lastMessageAt: new Date() });

  messages.forEach((message) => appEvents.emit('message:new', message));

  return messages;
};

module.exports = {
  sendMessages,
  queryMessages,
  pinMessage,
  deleteMessage,
  broadcastMessage,
};
