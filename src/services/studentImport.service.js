const crypto = require('crypto');
const httpStatus = require('http-status');
// eslint-disable-next-line import/no-unresolved -- eslint's resolver doesn't follow csv-parse's package.json "exports" map; Node resolves this fine
const { parse } = require('csv-parse/sync');
const Joi = require('joi');
const { User, Batch } = require('../models');
const ApiError = require('../utils/ApiError');
const conversationService = require('./conversation.service');
// reusing the exact same phone number rule enforced on POST /users, so a CSV row and a
// manually-entered student are held to the same standard
const { phoneNumber: phoneNumberRule } = require('../validations/custom.validation');

const REQUIRED_COLUMNS = ['phonenumber', 'name'];
const OPTIONAL_COLUMNS = ['email'];
const ALLOWED_COLUMNS = new Set([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

const rowSchema = Joi.object({
  phoneNumber: Joi.string().required().custom(phoneNumberRule),
  name: Joi.string().required().min(1),
  email: Joi.string().email(),
});

const structuralError = (message) => {
  const error = new ApiError(httpStatus.BAD_REQUEST, 'CSV validation failed');
  error.errors = [{ row: 1, message }];
  return error;
};

/**
 * Parse and strictly validate a student roster CSV: header must be exactly
 * phoneNumber,name[,email] (case-insensitive, any order), every data row must have a valid
 * phoneNumber and name, phone/email must not repeat within the file, and must not already
 * belong to an existing user. Nothing is created here - this only validates.
 * @param {Buffer} buffer
 * @returns {Promise<{rowNumber: number, phoneNumber: string, name: string, email: string|undefined}[]>}
 */
const parseAndValidateStudentsCsv = async (buffer) => {
  let table;
  try {
    table = parse(buffer, { skip_empty_lines: true, trim: true });
  } catch (err) {
    throw structuralError(`Could not parse CSV: ${err.message}`);
  }

  if (table.length === 0) {
    throw structuralError('CSV file is empty');
  }

  const headers = table[0].map((h) => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) {
    throw structuralError('Header row has duplicate column names');
  }
  const unknownColumns = headers.filter((h) => !ALLOWED_COLUMNS.has(h));
  if (unknownColumns.length > 0) {
    throw structuralError(`Unrecognized column(s): ${unknownColumns.join(', ')}. Expected: phoneNumber, name, email`);
  }
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingColumns.length > 0) {
    throw structuralError(`Missing required column(s): ${missingColumns.join(', ')}`);
  }

  const columnIndex = {};
  headers.forEach((h, i) => {
    columnIndex[h] = i;
  });

  const dataRows = table
    .slice(1)
    .map((raw, i) => ({ rowNumber: i + 2, raw }))
    .filter(({ raw }) => raw.some((cell) => cell !== ''));

  const errors = [];
  const rows = [];
  const phoneNumbersSeen = new Map();
  const emailsSeen = new Map();

  dataRows.forEach(({ rowNumber, raw }) => {
    const candidate = {
      phoneNumber: (raw[columnIndex.phonenumber] || '').trim(),
      name: (raw[columnIndex.name] || '').trim(),
      email: columnIndex.email !== undefined && raw[columnIndex.email] ? raw[columnIndex.email].trim() : undefined,
    };

    const { error, value } = rowSchema.validate(candidate, { abortEarly: false });
    if (error) {
      errors.push({ row: rowNumber, message: error.details.map((d) => d.message).join('; ') });
      return;
    }

    if (phoneNumbersSeen.has(value.phoneNumber)) {
      errors.push({
        row: rowNumber,
        message: `Duplicate phoneNumber within file (also on row ${phoneNumbersSeen.get(value.phoneNumber)})`,
      });
      return;
    }
    phoneNumbersSeen.set(value.phoneNumber, rowNumber);

    if (value.email) {
      const emailKey = value.email.toLowerCase();
      if (emailsSeen.has(emailKey)) {
        errors.push({ row: rowNumber, message: `Duplicate email within file (also on row ${emailsSeen.get(emailKey)})` });
        return;
      }
      emailsSeen.set(emailKey, rowNumber);
    }

    rows.push({ rowNumber, ...value });
  });

  if (rows.length > 0) {
    const [existingPhoneUsers, existingEmailUsers] = await Promise.all([
      User.find({ phoneNumber: { $in: rows.map((r) => r.phoneNumber) } }, 'phoneNumber'),
      User.find({ email: { $in: rows.filter((r) => r.email).map((r) => r.email.toLowerCase()) } }, 'email'),
    ]);
    const takenPhoneNumbers = new Set(existingPhoneUsers.map((u) => u.phoneNumber));
    const takenEmails = new Set(existingEmailUsers.map((u) => u.email));

    rows.forEach((row) => {
      if (takenPhoneNumbers.has(row.phoneNumber)) {
        errors.push({ row: row.rowNumber, message: `phoneNumber ${row.phoneNumber} is already registered` });
      }
      if (row.email && takenEmails.has(row.email.toLowerCase())) {
        errors.push({ row: row.rowNumber, message: `email ${row.email} is already registered` });
      }
    });
  }

  if (errors.length > 0) {
    errors.sort((a, b) => a.row - b.row);
    const error = new ApiError(httpStatus.BAD_REQUEST, 'CSV validation failed');
    error.errors = errors;
    throw error;
  }

  return rows;
};

/**
 * A random password meeting the User model's rule (>=8 chars, at least one letter and one
 * digit) regardless of what randomness comes back - returned to the admin so it can be
 * handed to the student, who is expected to change it after first login.
 * @returns {string}
 */
const generateTemporaryPassword = () => `${crypto.randomBytes(6).toString('hex')}X9`;

/**
 * Bulk-create students for a batch from a CSV roster. Validates the entire file upfront
 * (parseAndValidateStudentsCsv) so a bad file creates nothing; only once every row is clean
 * does it start creating users + their student_support conversations.
 * @param {ObjectId} batchId
 * @param {Buffer} csvBuffer
 * @param {User} triggeredBy
 * @returns {Promise<{batchId: string, batchName: string, createdCount: number, created: Object[], failed: Object[]}>}
 */
const importStudentsForBatch = async (batchId, csvBuffer, triggeredBy) => {
  if (triggeredBy.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }
  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');
  }

  const rows = await parseAndValidateStudentsCsv(csvBuffer);

  const created = [];
  const failed = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const password = generateTemporaryPassword();
      // eslint-disable-next-line no-await-in-loop
      const user = await User.create({
        name: row.name,
        phoneNumber: row.phoneNumber,
        ...(row.email && { email: row.email }),
        password,
        role: 'student',
        batchId: batch._id,
      });
      // eslint-disable-next-line no-await-in-loop
      await conversationService.createStudentConversation(user.id);
      created.push({ id: user.id, name: user.name, phoneNumber: user.phoneNumber, temporaryPassword: password });
    } catch (error) {
      failed.push({ row: row.rowNumber, phoneNumber: row.phoneNumber, message: error.message });
    }
  }

  return {
    batchId: batch.id,
    batchName: batch.name,
    createdCount: created.length,
    created,
    failed,
  };
};

module.exports = {
  parseAndValidateStudentsCsv,
  importStudentsForBatch,
};
