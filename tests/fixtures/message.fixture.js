const mongoose = require('mongoose');
const Message = require('../../src/models/message.model');
const { userOne, agent } = require('./user.fixture');
const { studentConversationOne } = require('./conversation.fixture');

const textMessageOne = {
  _id: mongoose.Types.ObjectId(),
  conversationId: studentConversationOne._id,
  senderId: userOne._id,
  contentType: 'text',
  text: 'Hello, I need help with my assignment',
};

const agentReplyOne = {
  _id: mongoose.Types.ObjectId(),
  conversationId: studentConversationOne._id,
  senderId: agent._id,
  contentType: 'text',
  text: 'Sure, how can I help?',
};

const insertMessages = async (messages) => {
  await Message.insertMany(messages);
};

module.exports = {
  textMessageOne,
  agentReplyOne,
  insertMessages,
};
