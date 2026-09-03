const httpStatus = require('http-status');
const pick = require('../utils/pick');
const catchAsync = require('../utils/catchAsync');
const { conversationService } = require('../services');

const getConversations = catchAsync(async (req, res) => {
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await conversationService.queryConversationsForUser(req.user, {}, options);
  res.send(result);
});

const createGroup = catchAsync(async (req, res) => {
  const conversation = await conversationService.createGroupConversation(req.user, req.body);
  res.status(httpStatus.CREATED).send(conversation);
});

const getConversation = catchAsync(async (req, res) => {
  const conversation = await conversationService.getConversationAndVerifyAccess(req.params.conversationId, req.user);
  res.send(await conversationService.attachUnreadCount(conversation));
});

const markRead = catchAsync(async (req, res) => {
  const conversation = await conversationService.markConversationRead(req.params.conversationId, req.user);
  res.send(conversation);
});

const updateGroup = catchAsync(async (req, res) => {
  const conversation = await conversationService.updateGroupConversation(req.params.conversationId, req.user, req.body);
  res.send(conversation);
});

const updateLabels = catchAsync(async (req, res) => {
  const conversation = await conversationService.updateConversationLabels(
    req.params.conversationId,
    req.user,
    req.body.labels
  );
  res.send(conversation);
});

const deleteConversation = catchAsync(async (req, res) => {
  await conversationService.deleteGroupConversation(req.params.conversationId, req.user);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  getConversations,
  createGroup,
  getConversation,
  updateGroup,
  updateLabels,
  markRead,
  deleteConversation,
};
