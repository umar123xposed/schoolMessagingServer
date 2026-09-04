const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const uploadValidation = require('../../validations/upload.validation');
const uploadController = require('../../controllers/upload.controller');

const router = express.Router();

router.post('/', auth(), validate(uploadValidation.uploadFile), uploadController.uploadFile);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: Presigned attachment uploads to Cloudflare R2
 */

/**
 * @swagger
 * /uploads:
 *   post:
 *     summary: Request a presigned upload for a message attachment
 *     description: >
 *       Any authenticated user can request an upload (students and agents both send attachments).
 *       This does not accept the file itself - it validates the declared mimeType/size against
 *       the server-side limits for the contentType, then returns a short-lived presigned URL.
 *       The client must PUT the raw file bytes directly to `uploadUrl`, setting the Content-Type
 *       header to exactly the declared mimeType, within `expiresIn` seconds - R2 rejects the PUT
 *       if the actual Content-Type/Content-Length don't match what was validated here. Once that
 *       PUT succeeds, send the returned `attachment` object as-is into a subsequent
 *       POST /conversations/{id}/messages call.
 *     tags: [Uploads]
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
 *               - mimeType
 *               - fileName
 *               - size
 *             properties:
 *               contentType:
 *                 type: string
 *                 enum: [image, audio, voice_note, video, pdf, file]
 *               mimeType:
 *                 type: string
 *                 example: image/jpeg
 *               fileName:
 *                 type: string
 *                 example: photo.jpg
 *               size:
 *                 type: integer
 *                 description: declared file size in bytes - checked against the per-contentType limit
 *               duration:
 *                 type: number
 *                 description: seconds - audio/voice_note/video only, computed client-side (e.g. the browser's Audio/Video element duration) and passed through as-is
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PresignedUpload'
 *       "400":
 *         description: The declared size/type fails the rules for the declared contentType
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
