const { phoneNumber } = require('../../../src/validations/custom.validation');

const helpers = { message: (msg) => ({ message: msg }) };

describe('custom.validation', () => {
  describe('phoneNumber', () => {
    test('accepts a number with a country code', () => {
      expect(phoneNumber('+15551234567', helpers)).toBe('+15551234567');
    });

    test('rejects a number missing the leading +', () => {
      const result = phoneNumber('15551234567', helpers);
      expect(result).toEqual({ message: expect.stringContaining('country code') });
    });

    test('rejects a bare local number with no country code at all', () => {
      const result = phoneNumber('5551234567', helpers);
      expect(result).toEqual({ message: expect.stringContaining('country code') });
    });

    test('rejects a country code starting with 0', () => {
      const result = phoneNumber('+05551234567', helpers);
      expect(result).toEqual({ message: expect.stringContaining('country code') });
    });

    test('rejects fewer than 7 digits after the +', () => {
      const result = phoneNumber('+123456', helpers);
      expect(result).toEqual({ message: expect.stringContaining('country code') });
    });

    test('rejects more than 15 digits after the +', () => {
      const result = phoneNumber('+1234567890123456', helpers);
      expect(result).toEqual({ message: expect.stringContaining('country code') });
    });
  });
});
