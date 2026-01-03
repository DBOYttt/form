import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateToken, getSessionExpiry, hashToken } from './token.js';

describe('Token Utils', () => {
  describe('generateToken', () => {
    it('should generate a token of default length', () => {
      const token = generateToken();
      // Default 64 bytes = 128 hex characters
      assert.strictEqual(token.length, 128);
    });

    it('should generate a token of specified length', () => {
      const token = generateToken(32);
      // 32 bytes = 64 hex characters
      assert.strictEqual(token.length, 64);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      assert.notStrictEqual(token1, token2);
    });

    it('should only contain hex characters', () => {
      const token = generateToken();
      assert.match(token, /^[a-f0-9]+$/);
    });
  });

  describe('getSessionExpiry', () => {
    it('should return a future date', () => {
      const expiry = getSessionExpiry();
      const now = new Date();
      assert.ok(expiry > now);
    });

    it('should be approximately 24 hours in the future', () => {
      const expiry = getSessionExpiry();
      const now = new Date();
      const diffMs = expiry.getTime() - now.getTime();
      const expectedMs = 24 * 60 * 60 * 1000;
      
      // Allow 1 second tolerance
      assert.ok(Math.abs(diffMs - expectedMs) < 1000);
    });
  });

  describe('hashToken', () => {
    it('should hash token consistently', () => {
      const token = 'test-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should produce 64-character SHA-256 hash', () => {
      const hash = hashToken('test');
      assert.strictEqual(hash.length, 64);
    });
  });
});
