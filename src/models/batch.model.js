const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const batchSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Check if a batch name is taken
 * @param {string} name
 * @param {ObjectId} [excludeBatchId]
 * @returns {Promise<boolean>}
 */
batchSchema.statics.isNameTaken = async function (name, excludeBatchId) {
  const batch = await this.findOne({ name, _id: { $ne: excludeBatchId } });
  return !!batch;
};

batchSchema.plugin(toJSON);
batchSchema.plugin(paginate);

/**
 * @typedef Batch
 */
const Batch = mongoose.model('Batch', batchSchema);

module.exports = Batch;
