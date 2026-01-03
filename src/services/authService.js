import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { config } from '../config.js';
import { generateToken, getSessionExpiry, hashToken } from '../utils/token.js';
import * as rateLimiter from '../utils/rateLimiter.js';
import * as sessionService from './sessionService.js';

/**
 * Validate login credentials and return user if valid
 */
async function validateCredentials(email, password) {
  const result = await query(
    'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
    [email.toLowerCase()],
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
 * Create a new session for a user (with metadata support)
 * Session tokens are hashed before storage for security
 */
async function createSession(userId, metadata = {}) {
  return sessionService.createSimpleSession(userId, metadata);
}

/**
 * Login a user
 */
export async function login(email, password, ip, userAgent = null) {
  // Validate input
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return { success: false, error: 'invalid_input', message: 'Email and password are required.' };
  }

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
    const remaining = config.rateLimit.maxAttempts - attempts;
    
    return {
      success: false,
      error: 'invalid_credentials',
      message: `Invalid email or password.${remaining > 0 ? ` ${remaining} attempt(s) remaining.` : ''}`,
    };
  }

  // Clear rate limiting on successful login
  rateLimiter.clearAttempts(email, ip);

  // Create session with metadata
  const session = await createSession(validation.user.id, { ip, userAgent });

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
  const result = await sessionService.revokeSessionByToken(token);
  return result;
}

/**
 * Logout all sessions for a user
 */
export async function logoutAll(userId, exceptSessionId = null) {
  return sessionService.revokeAllSessions(userId, exceptSessionId);
}

/**
 * Validate a session token
 */
export async function validateSession(token) {
  const session = await sessionService.validateSession(token);
  
  // Add role from session service result or default to 'user'
  if (session.valid && session.user) {
    session.user.role = session.user.role || 'user';
  }
  
  return session;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  return sessionService.cleanupExpiredSessions();
}

// Re-export session functions for convenience
export { 
  getActiveSessions, 
  revokeSession, 
  refreshSession,
  rotateSessionToken,
  startSessionCleanup,
  stopSessionCleanup,
} from './sessionService.js';
