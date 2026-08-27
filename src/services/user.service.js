const httpStatus = require('http-status');
const { User, Conversation, Message } = require('../models');
const ApiError = require('../utils/ApiError');
const conversationService = require('./conversation.service');

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
  if (await User.isPhoneNumberTaken(userBody.phoneNumber)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number already taken');
  }
  if (userBody.email && (await User.isEmailTaken(userBody.email))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  const user = await User.create(userBody);
  if (user.role === 'student') {
    try {
      await conversationService.createStudentConversation(user.id);
    } catch (error) {
      await User.findByIdAndDelete(user.id);
      throw error;
    }
  }
  return user;
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  const users = await User.paginate(filter, options);
  return users;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  return User.findById(id);
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email });
};

/**
 * Get user by phone number
 * @param {string} phoneNumber
 * @returns {Promise<User>}
 */
const getUserByPhoneNumber = async (phoneNumber) => {
  return User.findOne({ phoneNumber });
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.phoneNumber && (await User.isPhoneNumberTaken(updateBody.phoneNumber, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number already taken');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (user.role === 'student') {
    const conversation = await Conversation.findOne({ studentId: user._id });
    if (conversation) {
      await Message.deleteMany({ conversationId: conversation._id });
      await conversation.remove();
    }
  } else {
    await Conversation.updateMany(
      { type: 'agent_group', participantIds: user._id },
      { $pull: { participantIds: user._id } }
    );
  }
  await user.remove();
  return user;
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  getUserByPhoneNumber,
  updateUserById,
  deleteUserById,
};
