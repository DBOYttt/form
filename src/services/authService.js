import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { generateToken, getSessionExpiry } from '../utils/token.js';
import * as rateLimiter from '../utils/rateLimiter.js';

/**
 * Validate login credentials and return user if valid
 */
async function validateCredentials(email, password) {
  const result = await query(
    'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return { success: false, error: 'invalid_credentials' };
  }

  const user = result.rows[0];
  const passwordValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordValid) {
    return { success: false, error: 'invalid_credentials' };
  }

  if (!user.email_verified) {
    return { success: false, error: 'email_not_verified' };
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

/**
 * Create a new session for a user
 */
async function createSession(userId) {
  const token = generateToken();
  const expiresAt = getSessionExpiry();

  await query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );

  return { token, expiresAt };
}

/**
 * Login a user
 */
export async function login(email, password, ip) {
  // Check rate limiting
  const rateCheck = rateLimiter.isLoginAllowed(email, ip);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: 'rate_limited',
      message: rateCheck.message,
    };
  }

  // Validate credentials
  const validation = await validateCredentials(email, password);

  if (!validation.success) {
    // Record failed attempt
    rateLimiter.recordFailedAttempt(email, ip);

    if (validation.error === 'email_not_verified') {
      return {
        success: false,
        error: 'email_not_verified',
        message: 'Please verify your email address before logging in.',
      };
    }

    // Generic message for security
    const attempts = rateLimiter.getAttemptCount(email, ip);
    const remaining = 5 - attempts;
    
    return {
      success: false,
      error: 'invalid_credentials',
      message: `Invalid email or password.${remaining > 0 ? ` ${remaining} attempt(s) remaining.` : ''}`,
    };
  }

  // Clear rate limiting on successful login
  rateLimiter.clearAttempts(email, ip);

  // Create session
  const session = await createSession(validation.user.id);

  return {
    success: true,
    user: validation.user,
    session,
  };
}

/**
 * Logout - invalidate session by token
 */
export async function logout(token) {
  const result = await query(
    'DELETE FROM sessions WHERE token = $1 RETURNING id',
    [token]
  );

  return { success: result.rowCount > 0 };
}

/**
 * Logout all sessions for a user
 */
export async function logoutAll(userId) {
  const result = await query(
    'DELETE FROM sessions WHERE user_id = $1',
    [userId]
  );

  return { success: true, count: result.rowCount };
}

/**
 * Validate a session token
 */
export async function validateSession(token) {
  const result = await query(
    `SELECT s.id, s.user_id, s.expires_at, u.email, u.role 
     FROM sessions s 
     JOIN users u ON s.user_id = u.id 
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    return { valid: false };
  }

  const session = result.rows[0];
  return {
    valid: true,
    user: {
      id: session.user_id,
      email: session.email,
      role: session.role || 'user',
    },
    expiresAt: session.expires_at,
  };
}

/**
 * Refresh a session token - extends expiration
 */
export async function refreshSession(token) {
  const newToken = generateToken();
  const newExpiresAt = getSessionExpiry();

  const result = await query(
    `UPDATE sessions 
     SET token = $1, expires_at = $2 
     WHERE token = $3 AND expires_at > NOW()
     RETURNING id`,
    [newToken, newExpiresAt, token]
  );

  if (result.rowCount === 0) {
    return { success: false };
  }

  return {
    success: true,
    token: newToken,
    expiresAt: newExpiresAt,
  };
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  const result = await query(
    'DELETE FROM sessions WHERE expires_at < NOW()'
  );
  return { deleted: result.rowCount };
}
