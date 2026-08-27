const mongoose = require('mongoose');
const Template = require('../../src/models/template.model');
const { agent, superAdmin } = require('./user.fixture');

const sharedTemplateOne = {
  _id: mongoose.Types.ObjectId(),
  shortcut: '/1',
  content: "Thanks for reaching out, we'll get back to you shortly.",
  isShared: true,
  createdBy: agent._id,
};

const privateTemplateOne = {
  _id: mongoose.Types.ObjectId(),
  shortcut: '/2',
  content: 'Private note to self.',
  isShared: false,
  createdBy: superAdmin._id,
};

const insertTemplates = async (templates) => {
  await Template.insertMany(templates);
};

module.exports = {
  sharedTemplateOne,
  privateTemplateOne,
  insertTemplates,
};
