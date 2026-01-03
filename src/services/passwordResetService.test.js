import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

// Test the validatePasswordStrength through the validation module directly
import { validatePassword } from '../utils/validation.js';

describe('Password Reset Service - Password Validation', () => {
  describe('validatePassword (used by password reset)', () => {
    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePassword('Short1');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('8'));
    });

    it('should reject passwords without uppercase', () => {
      const result = validatePassword('lowercase123');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('uppercase'));
    });

    it('should reject passwords without lowercase', () => {
      const result = validatePassword('UPPERCASE123');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('lowercase'));
    });

    it('should reject passwords without numbers', () => {
      const result = validatePassword('NoNumbersHere');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('number'));
    });

    it('should accept valid passwords', () => {
      const result = validatePassword('ValidPass123');
      assert.strictEqual(result.valid, true);
    });

    it('should reject passwords over 128 characters', () => {
      const longPassword = 'A'.repeat(129) + 'a1';
      const result = validatePassword(longPassword);
      assert.strictEqual(result.valid, false);
    });

    it('should reject null/undefined passwords', () => {
      assert.strictEqual(validatePassword(null).valid, false);
      assert.strictEqual(validatePassword(undefined).valid, false);
      assert.strictEqual(validatePassword('').valid, false);
    });
  });
});
