const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const templateSchema = mongoose.Schema(
  {
    shortcut: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    isShared: {
      type: Boolean,
      default: false,
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

templateSchema.statics.isShortcutTaken = async function (shortcut, excludeTemplateId) {
  const template = await this.findOne({ shortcut, _id: { $ne: excludeTemplateId } });
  return !!template;
};

templateSchema.plugin(toJSON);
templateSchema.plugin(paginate);

/**
 * @typedef Template
 */
const Template = mongoose.model('Template', templateSchema);

module.exports = Template;
