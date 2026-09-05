const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const adminValidation = require('../../validations/admin.validation');
const adminController = require('../../controllers/admin.controller');

const router = express.Router();

router.get('/storage-stats', auth('manageBatchDeletion'), adminController.getStorageStats);

router
  .route('/batch-deletions')
  .get(auth('manageBatchDeletion'), validate(adminValidation.getBatchDeletionJobs), adminController.getBatchDeletionJobs);

router
  .route('/batch-deletions/:jobId')
  .get(auth('manageBatchDeletion'), validate(adminValidation.getBatchDeletionJob), adminController.getBatchDeletionJob);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Super-admin-only storage stats and batch deletion job polling (deletion itself is triggered via DELETE /batches/{id})
 */

/**
 * @swagger
 * /admin/storage-stats:
 *   get:
 *     summary: Live storage usage broken down by student batch/cohort
 *     description: Computed from message attachment metadata already tracked in the database, not by listing the R2 bucket. Informs when it's worth deleting an old batch.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 batches:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BatchStorageStat'
 *                 total:
 *                   $ref: '#/components/schemas/BatchStorageStat'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /admin/batch-deletions:
 *   get:
 *     summary: List batch deletion jobs
 *     description: Deletion itself is triggered via DELETE /batches/{id}, not here - this only lists/polls jobs already started.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, completed, failed]
 *       - in: query
 *         name: batchId
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
 *                     $ref: '#/components/schemas/BatchDeletionJob'
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
 * /admin/batch-deletions/{id}:
 *   get:
 *     summary: Get a batch deletion job's status/progress
 *     tags: [Admin]
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
 *               $ref: '#/components/schemas/BatchDeletionJob'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
