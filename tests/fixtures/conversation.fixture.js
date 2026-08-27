const mongoose = require('mongoose');
const Conversation = require('../../src/models/conversation.model');
const { userOne, userTwo, agent, superAdmin } = require('./user.fixture');

const studentConversationOne = {
  _id: mongoose.Types.ObjectId(),
  type: 'student_support',
  studentId: userOne._id,
  createdBy: userOne._id,
  labels: [],
};

const studentConversationTwo = {
  _id: mongoose.Types.ObjectId(),
  type: 'student_support',
  studentId: userTwo._id,
  createdBy: userTwo._id,
  labels: [],
};

const groupConversation = {
  _id: mongoose.Types.ObjectId(),
  type: 'agent_group',
  name: 'Front desk team',
  participantIds: [agent._id],
  createdBy: superAdmin._id,
};

const insertConversations = async (conversations) => {
  await Conversation.insertMany(conversations);
};

module.exports = {
  studentConversationOne,
  studentConversationTwo,
  groupConversation,
  insertConversations,
};
