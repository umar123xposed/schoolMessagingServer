const { EventEmitter } = require('events');

/**
 * In-process event bus decoupling services from the socket layer.
 * Services emit after a write succeeds; src/socket/index.js is the only listener,
 * relaying to the right Socket.io room(s). This keeps there being exactly one
 * write path (the service) regardless of whether it was triggered via REST or a socket.
 */
module.exports = new EventEmitter();
