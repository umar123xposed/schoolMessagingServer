const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const messageSchema = mongoose.Schema(
  {
    conversationId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    contentType: {
      type: String,
      enum: ['text', 'image', 'audio', 'voice_note', 'video', 'pdf', 'file'],
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
    attachment: {
      url: { type: String, trim: true },
      mimeType: { type: String, trim: true },
      size: { type: Number },
      fileName: { type: String, trim: true },
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
    pinnedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    isBroadcast: {
      type: Boolean,
      default: false,
    },
    broadcastGroupId: {
      type: mongoose.SchemaTypes.ObjectId,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.pre('validate', function (next) {
  if (this.contentType === 'text') {
    if (!this.text) {
      this.invalidate('text', 'text is required when contentType is text');
    }
  } else if (!this.attachment || !this.attachment.url) {
    this.invalidate('attachment', 'attachment.url is required when contentType is not text');
  }
  next();
});

messageSchema.plugin(toJSON);
messageSchema.plugin(paginate);

/**
 * @typedef Message
 */
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
