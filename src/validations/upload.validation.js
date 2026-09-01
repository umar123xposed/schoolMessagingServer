const Joi = require('joi');

const uploadFile = {
  body: Joi.object().keys({
    contentType: Joi.string().required().valid('image', 'audio', 'voice_note', 'video', 'pdf', 'file'),
    // seconds - audio/voice_note/video only, computed client-side (e.g. from the
    // browser's Audio/Video element) and passed through as-is, no server-side media processing
    duration: Joi.number().min(0),
  }),
};

module.exports = {
  uploadFile,
};
