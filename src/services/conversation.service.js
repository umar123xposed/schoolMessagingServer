const httpStatus = require('http-status');
const { Conversation, Message } = require('../models');
const ApiError = require('../utils/ApiError');
const appEvents = require('../utils/appEvents');

/**
 * Build the Mongo filter that determines which conversations a user may list
 * @param {User} user
 * @returns {Object}
 */
const getUserConversationFilter = (user) => {
  if (user.role === 'student') {
    return { type: 'student_support', studentId: user._id };
  }
  return {
    $or: [{ type: 'student_support' }, { type: 'agent_group', participantIds: user._id }],
  };
};

/**
 * Throw if the user may not read/write the given conversation
 * @param {Conversation} conversation
 * @param {User} user
 */
const assertUserCanAccessConversation = (conversation, user) => {
  if (user.role === 'student') {
    if (String(conversation.studentId) !== String(user._id)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
    }
    return;
  }
  if (conversation.type === 'student_support') {
    return;
  }
  const isParticipant = (conversation.participantIds || []).some((id) => String(id) === String(user._id));
  if (!isParticipant) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
};

/**
 * Create the single student_support conversation for a newly created student
 * @param {ObjectId} studentId
 * @returns {Promise<Conversation>}
 */
const createStudentConversation = async (studentId) => {
  const conversation = await Conversation.create({
    type: 'student_support',
    studentId,
    createdBy: studentId,
  });
  appEvents.emit('conversation:new', conversation);
  return conversation;
};

/**
 * Create an agent_group conversation - super_admin only
 * @param {User} creator
 * @param {Object} body - { name, participantIds }
 * @returns {Promise<Conversation>}
 */
const createGroupConversation = async (creator, body) => {
  if (creator.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
  const participantIds = [...body.participantIds, creator._id].filter(
    (id, index, ids) => ids.findIndex((other) => String(other) === String(id)) === index
  );
  const conversation = await Conversation.create({
    type: 'agent_group',
    name: body.name,
    participantIds,
    createdBy: creator._id,
  });
  appEvents.emit('conversation:group:created', conversation);
  return conversation;
};

/**
 * Query conversations visible to a user
 * @param {User} user
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const queryConversationsForUser = async (user, filter, options) => {
  const combinedFilter = { $and: [getUserConversationFilter(user), filter] };
  const paginateOptions = { ...options, sortBy: options.sortBy || 'lastMessageAt:desc' };
  return Conversation.paginate(combinedFilter, paginateOptions);
};

/**
 * Get a conversation by id
 * @param {ObjectId} conversationId
 * @returns {Promise<Conversation>}
 */
const getConversationById = async (conversationId) => {
  return Conversation.findById(conversationId);
};

/**
 * Get a conversation and verify the user may access it
 * @param {ObjectId} conversationId
 * @param {User} user
 * @returns {Promise<Conversation>}
 */
const getConversationAndVerifyAccess = async (conversationId, user) => {
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  assertUserCanAccessConversation(conversation, user);
  return conversation;
};

/**
 * Update the labels on a student_support conversation
 * @param {ObjectId} conversationId
 * @param {User} user
 * @param {ObjectId[]} labelIds
 * @returns {Promise<Conversation>}
 */
const updateConversationLabels = async (conversationId, user, labelIds) => {
  if (user.role !== 'agent' && user.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  if (conversation.type !== 'student_support') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Labels can only be set on student_support conversations');
  }
  conversation.labels = labelIds;
  await conversation.save();
  return conversation;
};

/**
 * Update an agent_group conversation's name/participants - super_admin only
 * @param {ObjectId} conversationId
 * @param {User} user
 * @param {Object} updateBody
 * @returns {Promise<Conversation>}
 */
const updateGroupConversation = async (conversationId, user, updateBody) => {
  if (user.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  if (conversation.type !== 'agent_group') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only agent_group conversations can be updated this way');
  }
  const body = { ...updateBody };
  if (body.participantIds && !body.participantIds.some((id) => String(id) === String(user._id))) {
    // keep the acting super_admin in the group - agent_group read/send access is participant-gated
    // even for super_admin, so dropping themselves here would lock them out of what they just edited
    body.participantIds = [...body.participantIds, user._id];
  }
  const previousParticipantIds = conversation.participantIds.map((id) => String(id));
  Object.assign(conversation, body);
  await conversation.save();
  appEvents.emit('conversation:group:updated', { conversation, previousParticipantIds });
  return conversation;
};

/**
 * Delete an agent_group conversation and its messages - super_admin only
 * @param {ObjectId} conversationId
 * @param {User} user
 * @returns {Promise<Conversation>}
 */
const deleteGroupConversation = async (conversationId, user) => {
  if (user.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  if (conversation.type !== 'agent_group') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only agent_group conversations can be deleted');
  }
  await Message.deleteMany({ conversationId: conversation._id });
  await conversation.remove();
  appEvents.emit('conversation:group:deleted', conversation);
  return conversation;
};

module.exports = {
  getUserConversationFilter,
  assertUserCanAccessConversation,
  createStudentConversation,
  createGroupConversation,
  queryConversationsForUser,
  getConversationById,
  getConversationAndVerifyAccess,
  updateConversationLabels,
  updateGroupConversation,
  deleteGroupConversation,
};
