import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as rateLimiter from './rateLimiter.js';

describe('Rate Limiter', () => {
  const testEmail = 'test@example.com';
  const testIp = '192.168.1.1';

  beforeEach(() => {
    // Clear attempts before each test
    rateLimiter.clearAttempts(testEmail, testIp);
  });

  it('should allow login with no previous attempts', () => {
    const result = rateLimiter.isLoginAllowed(testEmail, testIp);
    assert.strictEqual(result.allowed, true);
  });

  it('should track failed login attempts', () => {
    rateLimiter.recordFailedAttempt(testEmail, testIp);
    const count = rateLimiter.getAttemptCount(testEmail, testIp);
    assert.strictEqual(count, 1);
  });

  it('should show remaining attempts', () => {
    rateLimiter.recordFailedAttempt(testEmail, testIp);
    rateLimiter.recordFailedAttempt(testEmail, testIp);
    
    const result = rateLimiter.isLoginAllowed(testEmail, testIp);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remainingAttempts, 3);
  });

  it('should lock after max attempts', () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordFailedAttempt(testEmail, testIp);
    }
    
    const result = rateLimiter.isLoginAllowed(testEmail, testIp);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'locked');
    assert.ok(result.message.includes('locked'));
  });

  it('should clear attempts', () => {
    rateLimiter.recordFailedAttempt(testEmail, testIp);
    rateLimiter.recordFailedAttempt(testEmail, testIp);
    rateLimiter.clearAttempts(testEmail, testIp);
    
    const count = rateLimiter.getAttemptCount(testEmail, testIp);
    assert.strictEqual(count, 0);
  });

  it('should track attempts per email+ip combination', () => {
    rateLimiter.recordFailedAttempt(testEmail, testIp);
    rateLimiter.recordFailedAttempt('other@example.com', testIp);
    
    const count1 = rateLimiter.getAttemptCount(testEmail, testIp);
    const count2 = rateLimiter.getAttemptCount('other@example.com', testIp);
    
    assert.strictEqual(count1, 1);
    assert.strictEqual(count2, 1);
  });
});
