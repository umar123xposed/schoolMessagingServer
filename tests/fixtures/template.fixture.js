const mongoose = require('mongoose');
const Template = require('../../src/models/template.model');
const { agent, superAdmin } = require('./user.fixture');

const agentTemplateOne = {
  _id: mongoose.Types.ObjectId(),
  shortcut: '/1',
  content: "Thanks for reaching out, we'll get back to you shortly.",
  createdBy: agent._id,
};

const superAdminTemplateOne = {
  _id: mongoose.Types.ObjectId(),
  shortcut: '/1',
  content: 'Private note to self.',
  createdBy: superAdmin._id,
};

const insertTemplates = async (templates) => {
  await Template.insertMany(templates);
};

module.exports = {
  agentTemplateOne,
  superAdminTemplateOne,
  insertTemplates,
};
