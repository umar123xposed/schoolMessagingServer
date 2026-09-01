const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const parseUpload = require('../../middlewares/upload');
const uploadValidation = require('../../validations/upload.validation');
const uploadController = require('../../controllers/upload.controller');

const router = express.Router();

router.post('/', auth(), parseUpload, validate(uploadValidation.uploadFile), uploadController.uploadFile);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: Attachment uploads to Cloudflare R2
 */

/**
 * @swagger
 * /uploads:
 *   post:
 *     summary: Upload a message attachment
 *     description: >
 *       Any authenticated user can upload (students and agents both send attachments).
 *       Returns the attachment object to embed in a subsequent POST /conversations/{id}/messages call.
 *       Server-side size/type limits apply per contentType regardless of client-side compression.
 *       Send the contentType field before the file field in the multipart form.
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - contentType
 *               - file
 *             properties:
 *               contentType:
 *                 type: string
 *                 enum: [image, audio, voice_note, video, pdf, file]
 *               duration:
 *                 type: number
 *                 description: seconds - audio/voice_note/video only, computed client-side (e.g. the browser's Audio/Video element duration) and passed through as-is
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attachment'
 *       "400":
 *         description: Missing file, or the file fails the size/type rules for the declared contentType
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
