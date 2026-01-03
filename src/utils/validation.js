/**
 * Email and password validation utilities
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates email format
 * @param {string} email 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  
  if (trimmed.length > 255) {
    return { valid: false, error: 'Email must be 255 characters or less' };
  }
  
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true };
}

/**
 * Validates password strength
 * @param {string} password 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password must be 128 characters or less' };
  }
  
  // Check for at least one uppercase, one lowercase, and one number
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  return { valid: true };
}

/**
 * Validates password confirmation matches
 * @param {string} password 
 * @param {string} confirmPassword 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }
  return { valid: true };
}

/**
 * Validates complete registration input
 * @param {{ email: string, password: string, confirmPassword: string }} input 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRegistrationInput({ email, password, confirmPassword }) {
  const errors = [];
  
  const emailResult = validateEmail(email);
  if (!emailResult.valid) {
    errors.push(emailResult.error);
  }
  
  const passwordResult = validatePassword(password);
  if (!passwordResult.valid) {
    errors.push(passwordResult.error);
  }
  
  const matchResult = validatePasswordMatch(password, confirmPassword);
  if (!matchResult.valid) {
    errors.push(matchResult.error);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
