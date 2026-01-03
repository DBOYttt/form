/**
 * Rate Limiting Middleware
 * Provides configurable rate limiting for API endpoints
 */

import { config } from '../config.js';

// In-memory store for rate limiting (use Redis in production for multi-instance)
const requestCounts = new Map();

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.windowStart + data.windowMs) {
      requestCounts.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Create rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Maximum requests per window
 * @param {string} options.message - Error message when rate limited
 * @param {Function} options.keyGenerator - Function to generate rate limit key from request
 * @param {boolean} options.skipSuccessfulRequests - Don't count successful requests
 * @param {boolean} options.skipFailedRequests - Don't count failed requests
 */
export function rateLimit(options = {}) {
  const {
    windowMs = config.rateLimit?.windowMs || 15 * 60 * 1000,
    maxRequests = config.rateLimit?.maxAttempts || 100,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = requestCounts.get(key);

    // Initialize or reset if window has passed
    if (!record || now > record.windowStart + windowMs) {
      record = {
        count: 0,
        windowStart: now,
        windowMs,
      };
    }

    // Check if rate limited
    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'rate_limited',
        message,
        retryAfter,
      });
    }

    // Increment count
    record.count++;
    requestCounts.set(key, record);

    // Add headers
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil((record.windowStart + windowMs) / 1000)));

    // Handle skip options by hooking into response
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalEnd = res.end;
      res.end = function(...args) {
        if ((skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400)) {
          record.count = Math.max(0, record.count - 1);
          requestCounts.set(key, record);
        }
        return originalEnd.apply(this, args);
      };
    }

    next();
  };
}

/**
 * Strict rate limiter for sensitive endpoints (login, registration, password reset)
 */
export function strictRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many attempts. Please try again in 15 minutes.',
    keyGenerator: (req) => {
      // Rate limit by IP + endpoint
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      return `${ip}:${req.path}`;
    },
  });
}

/**
 * Rate limiter for authentication endpoints
 */
export function authRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: 'Too many authentication attempts. Please try again later.',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      const email = req.body?.email?.toLowerCase() || '';
      return `auth:${ip}:${email}`;
    },
  });
}

/**
 * General API rate limiter
 */
export function apiRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many requests. Please slow down.',
  });
}

export default rateLimit;
