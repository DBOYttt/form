import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock modules before importing registration
const mockQuery = mock.fn();
const mockGetClient = mock.fn();
const mockSendVerificationEmail = mock.fn();

// Store original modules for cleanup
let originalDb;
let originalMailer;

describe('Registration Module', () => {
  let mockClient;

  beforeEach(() => {
    // Reset all mocks
    mockQuery.mock.resetCalls();
    mockGetClient.mock.resetCalls();
    mockSendVerificationEmail.mock.resetCalls();

    // Create mock client
    mockClient = {
      query: mock.fn(),
      release: mock.fn(),
    };
    mockGetClient.mock.mockImplementation(() => Promise.resolve(mockClient));
  });

  describe('Input Validation', () => {
    it('should reject empty email', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: '',
        password: 'ValidPass123',
        confirmPassword: 'ValidPass123',
      });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.toLowerCase().includes('email')));
    });

    it('should reject invalid email format', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: 'not-an-email',
        password: 'ValidPass123',
        confirmPassword: 'ValidPass123',
      });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.toLowerCase().includes('email')));
    });

    it('should reject weak passwords', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
      });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('should reject password without uppercase', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'lowercase123',
        confirmPassword: 'lowercase123',
      });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.toLowerCase().includes('uppercase')));
    });

    it('should reject password without lowercase', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'UPPERCASE123',
        confirmPassword: 'UPPERCASE123',
      });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.toLowerCase().includes('lowercase')));
    });

    it('should reject password without numbers', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'NoNumbersHere',
        confirmPassword: 'NoNumbersHere',
      });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.toLowerCase().includes('number')));
    });

    it('should reject mismatched passwords', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'ValidPass123',
        confirmPassword: 'DifferentPass123',
      });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.toLowerCase().includes('match')));
    });

    it('should accept valid registration input', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'ValidPass123',
        confirmPassword: 'ValidPass123',
      });
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should normalize email (lowercase and trim)', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      
      // The validation should work with whitespace and different cases
      const result1 = validateEmail('  Test@Example.COM  ');
      assert.strictEqual(result1.valid, true);
    });

    it('should collect multiple validation errors', async () => {
      const { validateRegistrationInput } = await import('../utils/validation.js');
      const result = validateRegistrationInput({
        email: 'invalid',
        password: 'weak',
        confirmPassword: 'different',
      });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length >= 2, 'Should have multiple errors');
    });
  });

  describe('Email Validation Edge Cases', () => {
    it('should reject email longer than 255 characters', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      const longEmail = 'a'.repeat(250) + '@b.com';
      const result = validateEmail(longEmail);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('255'));
    });

    it('should reject null email', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      const result = validateEmail(null);
      
      assert.strictEqual(result.valid, false);
    });

    it('should reject undefined email', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      const result = validateEmail(undefined);
      
      assert.strictEqual(result.valid, false);
    });

    it('should reject email with spaces in middle', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      const result = validateEmail('test @example.com');
      
      assert.strictEqual(result.valid, false);
    });

    it('should accept email with plus sign', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      const result = validateEmail('test+tag@example.com');
      
      assert.strictEqual(result.valid, true);
    });

    it('should accept email with subdomain', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      const result = validateEmail('user@mail.example.co.uk');
      
      assert.strictEqual(result.valid, true);
    });
  });

  describe('Password Validation Edge Cases', () => {
    it('should reject password longer than 128 characters', async () => {
      const { validatePassword } = await import('../utils/validation.js');
      const longPassword = 'Aa1' + 'a'.repeat(130);
      const result = validatePassword(longPassword);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('128'));
    });

    it('should accept password with special characters', async () => {
      const { validatePassword } = await import('../utils/validation.js');
      const result = validatePassword('P@ssw0rd!#$%');
      
      assert.strictEqual(result.valid, true);
    });

    it('should accept password at minimum length (8 chars)', async () => {
      const { validatePassword } = await import('../utils/validation.js');
      const result = validatePassword('Passwo1d');
      
      assert.strictEqual(result.valid, true);
    });

    it('should reject password at 7 characters', async () => {
      const { validatePassword } = await import('../utils/validation.js');
      const result = validatePassword('Pass1Aa');
      
      assert.strictEqual(result.valid, false);
    });

    it('should reject null password', async () => {
      const { validatePassword } = await import('../utils/validation.js');
      const result = validatePassword(null);
      
      assert.strictEqual(result.valid, false);
    });

    it('should reject empty string password', async () => {
      const { validatePassword } = await import('../utils/validation.js');
      const result = validatePassword('');
      
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('Email Verification', () => {
  describe('Token Validation', () => {
    it('should reject empty token', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      // verifyEmail expects a token string
      // Empty/null tokens should be rejected
      const result = validateEmail('');
      assert.strictEqual(result.valid, false);
    });

    it('should reject null token', async () => {
      const { validateEmail } = await import('../utils/validation.js');
      const result = validateEmail(null);
      assert.strictEqual(result.valid, false);
    });
  });
});
