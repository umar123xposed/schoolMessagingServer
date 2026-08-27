const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const conversationSchema = mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['student_support', 'agent_group'],
      required: true,
    },
    studentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
    participantIds: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User',
      },
    ],
    name: {
      type: String,
      trim: true,
    },
    labels: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Label',
      },
    ],
    createdBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
    lastMessageAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ studentId: 1 }, { unique: true, partialFilterExpression: { studentId: { $exists: true } } });

conversationSchema.pre('validate', function (next) {
  if (this.type === 'student_support') {
    if (!this.studentId) {
      this.invalidate('studentId', 'studentId is required for student_support conversations');
    }
    if (this.participantIds && this.participantIds.length) {
      this.invalidate('participantIds', 'participantIds is not allowed for student_support conversations');
    }
  } else if (this.type === 'agent_group') {
    if (this.studentId) {
      this.invalidate('studentId', 'studentId is not allowed for agent_group conversations');
    }
    if (!this.participantIds || !this.participantIds.length) {
      this.invalidate('participantIds', 'participantIds is required for agent_group conversations');
    }
  }
  next();
});

conversationSchema.plugin(toJSON);
conversationSchema.plugin(paginate);

/**
 * @typedef Conversation
 */
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
