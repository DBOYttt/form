import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateRegistrationInput,
} from './validation.js';

describe('validateEmail', () => {
  it('should accept valid email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.org',
      'user+tag@example.co.uk',
      'a@b.co',
    ];
    
    for (const email of validEmails) {
      const result = validateEmail(email);
      assert.strictEqual(result.valid, true, `Expected ${email} to be valid`);
    }
  });
  
  it('should reject invalid email formats', () => {
    const invalidEmails = [
      '',
      'notanemail',
      '@example.com',
      'user@',
      'user@.com',
      'user @example.com',
      null,
      undefined,
    ];
    
    for (const email of invalidEmails) {
      const result = validateEmail(email);
      assert.strictEqual(result.valid, false, `Expected ${email} to be invalid`);
      assert.ok(result.error, `Expected error message for ${email}`);
    }
  });
  
  it('should reject emails over 255 characters', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    const result = validateEmail(longEmail);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('255'));
  });
});

describe('validatePassword', () => {
  it('should accept valid passwords', () => {
    const validPasswords = [
      'Password1',
      'SecurePass123',
      'MyP@ssw0rd!',
    ];
    
    for (const password of validPasswords) {
      const result = validatePassword(password);
      assert.strictEqual(result.valid, true, `Expected ${password} to be valid`);
    }
  });
  
  it('should reject passwords under 8 characters', () => {
    const result = validatePassword('Pass1');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('8'));
  });
  
  it('should reject passwords without lowercase', () => {
    const result = validatePassword('PASSWORD1');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('lowercase'));
  });
  
  it('should reject passwords without uppercase', () => {
    const result = validatePassword('password1');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('uppercase'));
  });
  
  it('should reject passwords without numbers', () => {
    const result = validatePassword('Password');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('number'));
  });
  
  it('should reject passwords over 128 characters', () => {
    const longPassword = 'Aa1' + 'a'.repeat(130);
    const result = validatePassword(longPassword);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('128'));
  });
});

describe('validatePasswordMatch', () => {
  it('should accept matching passwords', () => {
    const result = validatePasswordMatch('Password1', 'Password1');
    assert.strictEqual(result.valid, true);
  });
  
  it('should reject non-matching passwords', () => {
    const result = validatePasswordMatch('Password1', 'Password2');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('match'));
  });
});

describe('validateRegistrationInput', () => {
  it('should accept valid registration input', () => {
    const result = validateRegistrationInput({
      email: 'test@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });
  
  it('should collect all validation errors', () => {
    const result = validateRegistrationInput({
      email: 'invalid',
      password: 'weak',
      confirmPassword: 'different',
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length >= 2);
  });
});
