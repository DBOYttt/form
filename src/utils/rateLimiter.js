import { config } from '../config.js';

// In-memory store for login attempts (use Redis in production)
const loginAttempts = new Map();

/**
 * Get the key for tracking login attempts
 */
function getAttemptKey(email, ip) {
  return `${email}:${ip}`;
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(email, ip) {
  const key = getAttemptKey(email, ip);
  const now = Date.now();
  
  let attempts = loginAttempts.get(key);
  if (!attempts) {
    attempts = { count: 0, firstAttempt: now, lockedUntil: null };
  }

  // Reset if window has passed
  if (now - attempts.firstAttempt > config.rateLimit.windowMs) {
    attempts = { count: 0, firstAttempt: now, lockedUntil: null };
  }

  attempts.count++;

  // Lock account if max attempts exceeded
  if (attempts.count >= config.rateLimit.maxAttempts) {
    attempts.lockedUntil = now + config.rateLimit.lockoutDurationMs;
  }

  loginAttempts.set(key, attempts);
  return attempts;
}

/**
 * Check if login is allowed (not rate limited or locked out)
 */
export function isLoginAllowed(email, ip) {
  const key = getAttemptKey(email, ip);
  const attempts = loginAttempts.get(key);
  
  if (!attempts) {
    return { allowed: true };
  }

  const now = Date.now();

  // Check if locked out
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    const remainingMs = attempts.lockedUntil - now;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return {
      allowed: false,
      reason: 'locked',
      message: `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`,
      remainingMs,
    };
  }

  // Check if approaching limit
  if (attempts.count >= config.rateLimit.maxAttempts) {
    // Lockout has expired, reset
    loginAttempts.delete(key);
    return { allowed: true };
  }

  const remainingAttempts = config.rateLimit.maxAttempts - attempts.count;
  return {
    allowed: true,
    remainingAttempts,
  };
}

/**
 * Clear login attempts on successful login
 */
export function clearAttempts(email, ip) {
  const key = getAttemptKey(email, ip);
  loginAttempts.delete(key);
}

/**
 * Get current attempt count for testing/monitoring
 */
export function getAttemptCount(email, ip) {
  const key = getAttemptKey(email, ip);
  const attempts = loginAttempts.get(key);
  return attempts ? attempts.count : 0;
}
