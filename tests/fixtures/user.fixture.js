const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const faker = require('faker');
const User = require('../../src/models/user.model');

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const userOne = {
  _id: mongoose.Types.ObjectId(),
  name: faker.name.findName(),
  phoneNumber: faker.phone.phoneNumber('+1##########'),
  password,
  role: 'student',
  isEmailVerified: false,
};

const userTwo = {
  _id: mongoose.Types.ObjectId(),
  name: faker.name.findName(),
  phoneNumber: faker.phone.phoneNumber('+1##########'),
  password,
  role: 'student',
  isEmailVerified: false,
};

const agent = {
  _id: mongoose.Types.ObjectId(),
  name: faker.name.findName(),
  phoneNumber: faker.phone.phoneNumber('+1##########'),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'agent',
  isEmailVerified: false,
};

const superAdmin = {
  _id: mongoose.Types.ObjectId(),
  name: faker.name.findName(),
  phoneNumber: faker.phone.phoneNumber('+1##########'),
  password,
  role: 'super_admin',
  isEmailVerified: false,
};

const insertUsers = async (users) => {
  await User.insertMany(users.map((user) => ({ ...user, password: hashedPassword })));
};

module.exports = {
  userOne,
  userTwo,
  agent,
  superAdmin,
  insertUsers,
};
