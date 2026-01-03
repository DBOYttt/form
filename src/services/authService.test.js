import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hashToken } from '../utils/token.js';

describe('Auth Service - Token Hashing', () => {
  describe('hashToken for session tokens', () => {
    it('should produce consistent hashes', () => {
      const token = 'test-session-token-12345';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('session-token-1');
      const hash2 = hashToken('session-token-2');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should produce 64-character SHA-256 hash', () => {
      const hash = hashToken('any-session-token');
      assert.strictEqual(hash.length, 64);
      assert.match(hash, /^[a-f0-9]+$/);
    });

    it('should handle empty strings', () => {
      const hash = hashToken('');
      assert.strictEqual(hash.length, 64);
    });

    it('should handle special characters', () => {
      const hash = hashToken('token-with-special-chars!@#$%');
      assert.strictEqual(hash.length, 64);
    });
  });
});
