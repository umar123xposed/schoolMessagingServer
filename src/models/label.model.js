const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const labelSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

labelSchema.statics.isNameTaken = async function (name, excludeLabelId) {
  const label = await this.findOne({ name, _id: { $ne: excludeLabelId } });
  return !!label;
};

labelSchema.plugin(toJSON);
labelSchema.plugin(paginate);

/**
 * @typedef Label
 */
const Label = mongoose.model('Label', labelSchema);

module.exports = Label;
