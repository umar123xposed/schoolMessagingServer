const mongoose = require('mongoose');
const Label = require('../../src/models/label.model');

const urgentLabel = {
  _id: mongoose.Types.ObjectId(),
  name: 'urgent',
  color: '#ff0000',
};

const newStudentLabel = {
  _id: mongoose.Types.ObjectId(),
  name: 'new student',
  color: '#00ff00',
};

const insertLabels = async (labels) => {
  await Label.insertMany(labels);
};

module.exports = {
  urgentLabel,
  newStudentLabel,
  insertLabels,
};
