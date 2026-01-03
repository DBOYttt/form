import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure random token
 * @param {number} length - Length of the token in bytes (default: 32)
 * @returns {string} Hex-encoded token
 */
export function generateToken(length = 32) {
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
