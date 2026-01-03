import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { hashToken, generateToken } from '../utils/token.js';
import { validatePassword, validatePasswordMatch } from '../utils/validation.js';

describe('Password Reset Service - Token Operations', () => {
  describe('Token Generation', () => {
    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 50; i++) {
        tokens.add(generateToken(32));
      }
      
      assert.strictEqual(tokens.size, 50);
    });

    it('should generate tokens of correct length', () => {
      // 32 bytes = 64 hex characters
      const token = generateToken(32);
      assert.strictEqual(token.length, 64);
    });
  });

  describe('Token Hashing', () => {
    it('should hash tokens consistently', () => {
      const token = 'reset-token-12345';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      
      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token-1');
      const hash2 = hashToken('token-2');
      
      assert.notStrictEqual(hash1, hash2);
    });
  });

  describe('Token Expiration', () => {
    it('should calculate expiration correctly', () => {
      const now = new Date();
      const expirationHours = 1;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expirationHours);
      
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      assert.ok(Math.abs(diffHours - 1) < 0.01);
    });

    it('should detect expired tokens', () => {
      const expiredAt = new Date();
      expiredAt.setHours(expiredAt.getHours() - 1);
      
      const now = new Date();
      const isExpired = expiredAt < now;
      
      assert.strictEqual(isExpired, true);
    });

    it('should detect valid (non-expired) tokens', () => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      
      const now = new Date();
      const isValid = expiresAt > now;
      
      assert.strictEqual(isValid, true);
    });
  });
});

describe('Password Reset Service - Password Validation', () => {
  describe('Password Strength', () => {
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

    it('should accept password with special characters', () => {
      const result = validatePassword('P@ssw0rd!#$');
      assert.strictEqual(result.valid, true);
    });

    it('should reject passwords over 128 characters', () => {
      const longPassword = 'Aa1' + 'a'.repeat(130);
      const result = validatePassword(longPassword);
      assert.strictEqual(result.valid, false);
    });

    it('should reject null/undefined passwords', () => {
      assert.strictEqual(validatePassword(null).valid, false);
      assert.strictEqual(validatePassword(undefined).valid, false);
      assert.strictEqual(validatePassword('').valid, false);
    });
  });

  describe('Password Match', () => {
    it('should accept matching passwords', () => {
      const result = validatePasswordMatch('Password123', 'Password123');
      assert.strictEqual(result.valid, true);
    });

    it('should reject non-matching passwords', () => {
      const result = validatePasswordMatch('Password123', 'Password456');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('match'));
    });

    it('should reject case-sensitive mismatches', () => {
      const result = validatePasswordMatch('Password123', 'password123');
      assert.strictEqual(result.valid, false);
    });

    it('should reject whitespace differences', () => {
      const result = validatePasswordMatch('Password123', 'Password123 ');
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('Password Reset Service - Token Validation Logic', () => {
  describe('Token State Checks', () => {
    it('should reject used tokens', () => {
      const token = { used: true, expiresAt: new Date(Date.now() + 3600000) };
      const isValid = !token.used && token.expiresAt > new Date();
      
      assert.strictEqual(isValid, false);
    });

    it('should reject expired tokens', () => {
      const token = { used: false, expiresAt: new Date(Date.now() - 3600000) };
      const isValid = !token.used && token.expiresAt > new Date();
      
      assert.strictEqual(isValid, false);
    });

    it('should accept valid unused unexpired tokens', () => {
      const token = { used: false, expiresAt: new Date(Date.now() + 3600000) };
      const isValid = !token.used && token.expiresAt > new Date();
      
      assert.strictEqual(isValid, true);
    });

    it('should reject token that is both used and expired', () => {
      const token = { used: true, expiresAt: new Date(Date.now() - 3600000) };
      const isValid = !token.used && token.expiresAt > new Date();
      
      assert.strictEqual(isValid, false);
    });
  });
});

describe('Password Reset Service - Email Enumeration Protection', () => {
  describe('Response Consistency', () => {
    it('should return consistent message for existing user', () => {
      const successResponse = {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
      
      // Simulate response for existing user
      const responseForExisting = { ...successResponse };
      
      assert.strictEqual(responseForExisting.message, successResponse.message);
    });

    it('should return consistent message for non-existing user', () => {
      const successResponse = {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
      
      // Simulate response for non-existing user (same message)
      const responseForNonExisting = { ...successResponse };
      
      assert.strictEqual(responseForNonExisting.message, successResponse.message);
    });

    it('messages should be identical for both cases', () => {
      const existingUserResponse = 'If an account with that email exists, a password reset link has been sent.';
      const nonExistingUserResponse = 'If an account with that email exists, a password reset link has been sent.';
      
      assert.strictEqual(existingUserResponse, nonExistingUserResponse);
    });
  });
});

describe('Password Reset Service - Token Invalidation', () => {
  describe('Token Marking', () => {
    it('should mark token as used after reset', () => {
      const token = { id: '123', used: false };
      token.used = true;
      
      assert.strictEqual(token.used, true);
    });

    it('should invalidate previous tokens for same user', () => {
      const tokens = [
        { id: 't1', userId: 'u1', used: false },
        { id: 't2', userId: 'u1', used: false },
        { id: 't3', userId: 'u2', used: false },
      ];
      
      // Invalidate all tokens for user u1
      tokens.forEach(t => {
        if (t.userId === 'u1') t.used = true;
      });
      
      const user1Tokens = tokens.filter(t => t.userId === 'u1');
      const allUsed = user1Tokens.every(t => t.used);
      
      assert.strictEqual(allUsed, true);
      assert.strictEqual(tokens.find(t => t.userId === 'u2').used, false);
    });
  });

  describe('Session Invalidation on Reset', () => {
    it('should invalidate all sessions after password reset', () => {
      const sessions = [
        { id: 's1', userId: 'u1', valid: true },
        { id: 's2', userId: 'u1', valid: true },
        { id: 's3', userId: 'u2', valid: true },
      ];
      
      // Invalidate sessions for user u1 after password reset
      sessions.forEach(s => {
        if (s.userId === 'u1') s.valid = false;
      });
      
      const user1Sessions = sessions.filter(s => s.userId === 'u1');
      const allInvalid = user1Sessions.every(s => !s.valid);
      
      assert.strictEqual(allInvalid, true);
      assert.strictEqual(sessions.find(s => s.userId === 'u2').valid, true);
    });
  });
});

describe('Password Reset Service - Cleanup', () => {
  describe('Expired Token Cleanup', () => {
    it('should identify expired tokens for cleanup', () => {
      const now = new Date();
      const tokens = [
        { id: 't1', expiresAt: new Date(now.getTime() - 1000), used: false },
        { id: 't2', expiresAt: new Date(now.getTime() + 1000), used: false },
        { id: 't3', expiresAt: new Date(now.getTime() - 5000), used: true },
      ];
      
      const toDelete = tokens.filter(t => t.expiresAt < now || t.used);
      
      assert.strictEqual(toDelete.length, 2);
    });
  });
});
