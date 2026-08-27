const faker = require('faker');
const { User } = require('../../../src/models');

describe('User model', () => {
  describe('User validation', () => {
    let newUser;
    beforeEach(() => {
      newUser = {
        name: faker.name.findName(),
        phoneNumber: faker.phone.phoneNumber('+1##########'),
        password: 'password1',
        role: 'student',
      };
    });

    test('should correctly validate a valid user with no email', async () => {
      await expect(new User(newUser).validate()).resolves.toBeUndefined();
    });

    test('should throw a validation error if phoneNumber is missing', async () => {
      delete newUser.phoneNumber;
      await expect(new User(newUser).validate()).rejects.toThrow();
    });

    test('should throw a validation error if email is invalid', async () => {
      newUser.email = 'invalidEmail';
      await expect(new User(newUser).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password length is less than 8 characters', async () => {
      newUser.password = 'passwo1';
      await expect(new User(newUser).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password does not contain numbers', async () => {
      newUser.password = 'password';
      await expect(new User(newUser).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password does not contain letters', async () => {
      newUser.password = '11111111';
      await expect(new User(newUser).validate()).rejects.toThrow();
    });

    test('should throw a validation error if role is unknown', async () => {
      newUser.role = 'invalid';
      await expect(new User(newUser).validate()).rejects.toThrow();
    });
  });

  describe('User toJSON()', () => {
    test('should not return user password when toJSON is called', () => {
      const newUser = {
        name: faker.name.findName(),
        phoneNumber: faker.phone.phoneNumber('+1##########'),
        password: 'password1',
        role: 'student',
      };
      expect(new User(newUser).toJSON()).not.toHaveProperty('password');
    });
  });
});
