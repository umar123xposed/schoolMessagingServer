const express = require('express');
const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const conversationRoute = require('./conversation.route');
const messageRoute = require('./message.route');
const labelRoute = require('./label.route');
const batchRoute = require('./batch.route');
const templateRoute = require('./template.route');
const uploadRoute = require('./upload.route');
const adminRoute = require('./admin.route');
const docsRoute = require('./docs.route');
const config = require('../../config/config');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/conversations',
    route: conversationRoute,
  },
  {
    path: '/',
    route: messageRoute,
  },
  {
    path: '/labels',
    route: labelRoute,
  },
  {
    path: '/batches',
    route: batchRoute,
  },
  {
    path: '/templates',
    route: templateRoute,
  },
  {
    path: '/uploads',
    route: uploadRoute,
  },
  {
    path: '/admin',
    route: adminRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;
