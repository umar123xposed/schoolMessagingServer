const mongoose = require('mongoose');
const Batch = require('../../src/models/batch.model');

const batchFall = {
  _id: mongoose.Types.ObjectId(),
  name: '2026-fall',
};

const batchSpring = {
  _id: mongoose.Types.ObjectId(),
  name: '2026-spring',
};

const insertBatches = async (batches) => {
  await Batch.insertMany(batches);
};

module.exports = {
  batchFall,
  batchSpring,
  insertBatches,
};
