const httpStatus = require('http-status');
const pick = require('../utils/pick');
const catchAsync = require('../utils/catchAsync');
const { messageService } = require('../services');

const getMessages = catchAsync(async (req, res) => {
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await messageService.queryMessages(req.params.conversationId, req.user, options);
  res.send(result);
});

const sendMessages = catchAsync(async (req, res) => {
  const messages = await messageService.sendMessages(req.params.conversationId, req.user, req.body);
  res.status(httpStatus.CREATED).send(messages);
});

const pinMessage = catchAsync(async (req, res) => {
  const message = await messageService.pinMessage(req.params.messageId, req.user, req.body.isPinned);
  res.send(message);
});

const deleteMessage = catchAsync(async (req, res) => {
  await messageService.deleteMessage(req.params.messageId, req.user);
  res.status(httpStatus.NO_CONTENT).send();
});

const broadcastMessage = catchAsync(async (req, res) => {
  const messages = await messageService.broadcastMessage(req.user, req.body);
  res.status(httpStatus.CREATED).send(messages);
});

module.exports = {
  getMessages,
  sendMessages,
  pinMessage,
  deleteMessage,
  broadcastMessage,
};
