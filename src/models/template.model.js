const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const templateSchema = mongoose.Schema(
  {
    shortcut: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

templateSchema.index({ createdBy: 1, shortcut: 1 }, { unique: true });

/**
 * Check if a shortcut is already taken by this same creator
 * @param {string} shortcut
 * @param {ObjectId} createdBy
 * @param {ObjectId} [excludeTemplateId]
 * @returns {Promise<boolean>}
 */
templateSchema.statics.isShortcutTaken = async function (shortcut, createdBy, excludeTemplateId) {
  const template = await this.findOne({ shortcut, createdBy, _id: { $ne: excludeTemplateId } });
  return !!template;
};

templateSchema.plugin(toJSON);
templateSchema.plugin(paginate);

/**
 * @typedef Template
 */
const Template = mongoose.model('Template', templateSchema);

module.exports = Template;
