const setupTestDB = require('../utils/setupTestDB');
const ApiError = require('../../src/utils/ApiError');
const studentImportService = require('../../src/services/studentImport.service');
const { agent, insertUsers } = require('../fixtures/user.fixture');

setupTestDB();

describe('studentImport.service', () => {
  describe('parseAndValidateStudentsCsv', () => {
    test('accepts a case-insensitive header in any column order', async () => {
      const csv = 'Name,PhoneNumber\nJane Doe,+15551230001\n';
      const rows = await studentImportService.parseAndValidateStudentsCsv(Buffer.from(csv));

      expect(rows).toEqual([{ rowNumber: 2, phoneNumber: '+15551230001', name: 'Jane Doe' }]);
    });

    test('rejects an empty file', async () => {
      await expect(studentImportService.parseAndValidateStudentsCsv(Buffer.from(''))).rejects.toBeInstanceOf(ApiError);
    });

    test('rejects an unrecognized column', async () => {
      const csv = 'phoneNumber,name,batch\n+15551230001,Jane Doe,2026-fall\n';

      const error = await studentImportService.parseAndValidateStudentsCsv(Buffer.from(csv)).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.errors[0].message).toMatch(/unrecognized column/i);
    });

    test('rejects a duplicate column in the header row', async () => {
      const csv = 'phoneNumber,name,name\n+15551230001,Jane Doe,Jane\n';

      const error = await studentImportService.parseAndValidateStudentsCsv(Buffer.from(csv)).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.errors[0].message).toMatch(/duplicate column/i);
    });

    test('skips trailing blank lines without erroring', async () => {
      const csv = 'phoneNumber,name\n+15551230001,Jane Doe\n\n';
      const rows = await studentImportService.parseAndValidateStudentsCsv(Buffer.from(csv));

      expect(rows).toHaveLength(1);
    });

    test('collects every row error at once rather than stopping at the first', async () => {
      const csv = 'phoneNumber,name\nnot-a-phone,\n+15551230002,Jane Doe\n+15551230002,Duplicate\n';

      const error = await studentImportService.parseAndValidateStudentsCsv(Buffer.from(csv)).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.errors.map((e) => e.row)).toEqual([2, 4]);
    });

    test('rejects a phone number with no country code', async () => {
      const csv = 'phoneNumber,name\n5551234567,Jane Doe\n';

      const error = await studentImportService.parseAndValidateStudentsCsv(Buffer.from(csv)).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.errors[0].message).toMatch(/country code/i);
    });

    test('flags an email already registered to an existing user', async () => {
      await insertUsers([agent]);
      const csv = `phoneNumber,name,email\n+15551230009,New Name,${agent.email}\n`;

      const error = await studentImportService.parseAndValidateStudentsCsv(Buffer.from(csv)).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.errors[0].message).toMatch(/already registered/i);
    });
  });
});
