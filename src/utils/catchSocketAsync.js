const logger = require('../config/logger');

/**
 * Socket.io equivalent of utils/catchAsync.js - wraps a socket event handler so a
 * rejected promise emits a safe 'error' event back to the client instead of crashing
 * the process via an unhandled rejection.
 * @param {import('socket.io').Socket} socket
 * @param {Function} fn
 * @returns {Function}
 */
const catchSocketAsync =
  (socket, fn) =>
  (...args) => {
    Promise.resolve(fn(...args)).catch((err) => {
      logger.error(err);
      socket.emit('error', { message: err.message || 'Something went wrong' });
    });
  };

module.exports = catchSocketAsync;
