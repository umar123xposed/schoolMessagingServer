const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const batchDeletionJobSchema = mongoose.Schema(
  {
    batchLabel: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    triggeredBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    startedAt: {
      type: Date,
    },
    finishedAt: {
      type: Date,
    },
    counts: {
      students: { type: Number, default: 0 },
      conversations: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      attachmentsDeleted: { type: Number, default: 0 },
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

batchDeletionJobSchema.plugin(toJSON);
batchDeletionJobSchema.plugin(paginate);

/**
 * @typedef BatchDeletionJob
 */
const BatchDeletionJob = mongoose.model('BatchDeletionJob', batchDeletionJobSchema);

module.exports = BatchDeletionJob;
