const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const messageValidation = require('../../validations/message.validation');
const messageController = require('../../controllers/message.controller');

const router = express.Router();

router
  .route('/conversations/:conversationId/messages')
  .get(auth(), validate(messageValidation.getMessages), messageController.getMessages)
  .post(auth(), validate(messageValidation.sendMessages), messageController.sendMessages);

router.post(
  '/messages/broadcast',
  auth('broadcastMessage'),
  validate(messageValidation.broadcastMessage),
  messageController.broadcastMessage
);

router
  .route('/messages/:messageId')
  .delete(auth(), validate(messageValidation.deleteMessage), messageController.deleteMessage);

router.patch(
  '/messages/:messageId/pin',
  auth('pinMessage'),
  validate(messageValidation.pinMessage),
  messageController.pinMessage
);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Sending, pinning, deleting, and broadcasting messages
 */

/**
 * @swagger
 * /conversations/{id}/messages:
 *   get:
 *     summary: Get the message history of a conversation
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalResults:
 *                   type: integer
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   post:
 *     summary: Send one or more messages into a conversation
 *     description: The body may be a single message object, or an array of message objects to send several messages in one go.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/Message'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/Message'
 *           example:
 *             contentType: text
 *             text: Hello!
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /messages/broadcast:
 *   post:
 *     summary: Forward/broadcast a message to multiple students, or all of them
 *     description: Only agents and the super admin can broadcast. Provide either targetConversationIds or toAll, not both. Writes one message per target, all sharing one broadcastGroupId.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentType
 *             properties:
 *               contentType:
 *                 type: string
 *                 enum: [text, image, audio, voice_note, video, pdf, file]
 *               text:
 *                 type: string
 *               attachment:
 *                 type: object
 *               targetConversationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               toAll:
 *                 type: boolean
 *             example:
 *               contentType: text
 *               text: School will be closed tomorrow.
 *               toAll: true
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       "400":
 *         description: All broadcast targets must be existing student_support conversations
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /messages/{id}:
 *   delete:
 *     summary: Soft-delete a message
 *     description: Allowed for the original sender, or the super admin.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "204":
 *         description: No content
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /messages/{id}/pin:
 *   patch:
 *     summary: Pin or unpin a message
 *     description: Only the super admin can pin/unpin messages.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isPinned
 *             properties:
 *               isPinned:
 *                 type: boolean
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
