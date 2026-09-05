const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const batchValidation = require('../../validations/batch.validation');
const batchController = require('../../controllers/batch.controller');

const router = express.Router();

router
  .route('/')
  .post(auth('manageBatches'), validate(batchValidation.createBatch), batchController.createBatch)
  .get(auth('manageBatches'), validate(batchValidation.getBatches), batchController.getBatches);

router
  .route('/:batchId')
  .get(auth('manageBatches'), validate(batchValidation.getBatch), batchController.getBatch)
  .patch(auth('manageBatches'), validate(batchValidation.updateBatch), batchController.updateBatch)
  .delete(auth('manageBatchDeletion'), validate(batchValidation.deleteBatch), batchController.deleteBatch);

router
  .route('/:batchId/students')
  .get(auth('manageBatches'), validate(batchValidation.getBatchStudents), batchController.getBatchStudents);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Batches
 *   description: Student batch/cohort management - super_admin only
 */

/**
 * @swagger
 * /batches:
 *   post:
 *     summary: Create a batch/cohort
 *     description: Super admin creates a batch first, then assigns students to it by id (POST /users with batchId) - this avoids students being tagged with a mistyped free-text cohort label.
 *     tags: [Batches]
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
 *             properties:
 *               name:
 *                 type: string
 *             example:
 *               name: 2026-fall
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Batch'
 *       "400":
 *         description: Batch name already taken
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *
 *   get:
 *     summary: List batches
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
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
 *                     $ref: '#/components/schemas/Batch'
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
 */

/**
 * @swagger
 * /batches/{id}:
 *   get:
 *     summary: Get a batch
 *     tags: [Batches]
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
 *               $ref: '#/components/schemas/Batch'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Rename a batch
 *     tags: [Batches]
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
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Batch'
 *       "400":
 *         description: Batch name already taken
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Permanently delete a batch, its students, and all their data
 *     description: >
 *       Deletes every student in this batch along with their conversations, messages, and R2
 *       attachment files, then the batch record itself - never on a schedule, only triggered
 *       manually by the super admin. Deletion runs as a background job; this endpoint returns
 *       immediately with the job's id so progress can be polled via
 *       GET /admin/batch-deletions/{id}. The request body must echo the batch's exact current
 *       name as a confirmation.
 *     tags: [Batches]
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
 *               - confirmName
 *             properties:
 *               confirmName:
 *                 type: string
 *                 description: must exactly match the batch's current name
 *     responses:
 *       "202":
 *         description: Accepted - deletion job started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchDeletionJob'
 *       "400":
 *         description: confirmName does not match the batch's name
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /batches/{id}/students:
 *   get:
 *     summary: List the students in a batch
 *     tags: [Batches]
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
 *                     $ref: '#/components/schemas/User'
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
 */
