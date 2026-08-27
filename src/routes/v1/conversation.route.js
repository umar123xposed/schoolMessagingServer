const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const conversationValidation = require('../../validations/conversation.validation');
const conversationController = require('../../controllers/conversation.controller');

const router = express.Router();

router
  .route('/')
  .get(auth(), validate(conversationValidation.getConversations), conversationController.getConversations)
  .post(auth('manageGroupChats'), validate(conversationValidation.createGroup), conversationController.createGroup);

router
  .route('/:conversationId')
  .get(auth(), validate(conversationValidation.getConversation), conversationController.getConversation)
  .patch(auth('manageGroupChats'), validate(conversationValidation.updateGroup), conversationController.updateGroup)
  .delete(
    auth('manageGroupChats'),
    validate(conversationValidation.deleteConversation),
    conversationController.deleteConversation
  );

router
  .route('/:conversationId/labels')
  .patch(auth(), validate(conversationValidation.updateLabels), conversationController.updateLabels);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Student support chats and agent group chats
 */

/**
 * @swagger
 * /conversations:
 *   get:
 *     summary: List conversations visible to the current user
 *     description: A student sees only their own student_support conversation. An agent or super_admin sees every student_support conversation plus the agent_group conversations they participate in.
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: sort by query in the form of field:desc/asc (default lastMessageAt:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 1
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
 *                     $ref: '#/components/schemas/Conversation'
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
 *
 *   post:
 *     summary: Create an agent-only group chat
 *     description: Only the super admin can create group chats. Other agents are added as participants.
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - participantIds
 *             properties:
 *               name:
 *                 type: string
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *             example:
 *               name: Front desk team
 *               participantIds: ["5ebac534954b54139806c117"]
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /conversations/{id}:
 *   get:
 *     summary: Get a conversation
 *     description: Only accessible to a student for their own conversation, or an agent/super_admin for any student_support conversation or agent_group conversation they participate in.
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Update a group chat's name/participants
 *     description: Only the super admin can update a group chat. Only works on agent_group conversations.
 *     tags: [Conversations]
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
 *             properties:
 *               name:
 *                 type: string
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       "400":
 *         description: Only agent_group conversations can be updated this way
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Delete a group chat
 *     description: Only the super admin can delete a conversation, and only agent_group conversations - a student's support conversation can never be deleted this way.
 *     tags: [Conversations]
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
 *       "400":
 *         description: Only agent_group conversations can be deleted
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /conversations/{id}/labels:
 *   patch:
 *     summary: Set the labels/tags on a student's conversation
 *     description: Any agent or super_admin can tag a student_support conversation. Not available on agent_group conversations.
 *     tags: [Conversations]
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
 *               - labels
 *             properties:
 *               labels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       "400":
 *         description: Labels can only be set on student_support conversations
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
