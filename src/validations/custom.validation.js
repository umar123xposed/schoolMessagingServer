const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid mongo id');
  }
  return value;
};

const password = (value, helpers) => {
  if (value.length < 8) {
    return helpers.message('password must be at least 8 characters');
  }
  if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
    return helpers.message('password must contain at least 1 letter and 1 number');
  }
  return value;
};

const phoneNumber = (value, helpers) => {
  // E.164-style: mandatory leading +, country code can't start with 0, 7-15 digits total after the +
  if (!value.match(/^\+[1-9]\d{6,14}$/)) {
    return helpers.message('phoneNumber must include a country code (e.g. +15551234567)');
  }
  return value;
};

module.exports = {
  objectId,
  password,
  phoneNumber,
};
