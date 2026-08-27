const Joi = require('joi');

const uploadFile = {
  body: Joi.object().keys({
    contentType: Joi.string().required().valid('image', 'audio', 'voice_note', 'video', 'pdf', 'file'),
  }),
};

module.exports = {
  uploadFile,
};
