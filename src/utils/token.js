import { randomBytes, createHash } from 'crypto';
import { config } from '../config.js';

/**
 * Generates a cryptographically secure random token
 * @param {number} length - Length of the token in bytes (default: session.tokenLength)
 * @returns {string} Hex-encoded token
 */
export function generateToken(length = config.session.tokenLength) {
  return randomBytes(length).toString('hex');
}

/**
 * Generates token expiration date
 * @param {number} hours - Hours until expiration (default: 24)
 * @returns {Date}
 */
export function getTokenExpiration(hours = 24) {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + hours);
  return expiration;
}

/**
 * Calculate session expiration time
 * @returns {Date}
 */
export function getSessionExpiry() {
  return new Date(Date.now() + config.session.expiresInMs);
}

/**
 * Hash a token for secure storage (prevents timing attacks on database lookups)
 * @param {string} token - Plain token
 * @returns {string} SHA-256 hash of the token
 */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
