import { config } from '../config.js';

// In-memory stores for different rate limit types
const requestCounts = new Map();

// Cleanup interval
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.windowStart + data.windowMs) {
      requestCounts.delete(key);
    }
  }
}

// Start periodic cleanup
const cleanupInterval = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Create a rate limiting middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Maximum requests per window
 * @param {string} options.keyGenerator - Function to generate key from request
 * @param {string} options.message - Error message when rate limited
 */
export function rateLimit({
  windowMs = config.security?.rateLimitWindowMs || 900000,
  maxRequests = config.security?.rateLimitMaxRequests || 100,
  keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message = 'Too many requests. Please try again later.',
} = {}) {
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let data = requestCounts.get(key);

    // Reset if window has passed
    if (!data || now > data.windowStart + data.windowMs) {
      data = { count: 0, windowStart: now, windowMs };
    }

    data.count++;
    requestCounts.set(key, data);

    // Check if over limit
    if (data.count > maxRequests) {
      const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({
        success: false,
        error: 'rate_limited',
        message,
        retryAfter,
      });
    }

    // Add rate limit headers
    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - data.count));
    res.set('X-RateLimit-Reset', Math.ceil((data.windowStart + windowMs) / 1000));

    next();
  };
}

/**
 * Strict rate limit for sensitive operations (registration, password reset)
 * 5 requests per 15 minutes per IP
 */
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many attempts. Please try again in 15 minutes.',
});

/**
 * Standard rate limit for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const standardRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many requests. Please try again later.',
});
