import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';

// Session configuration
const SESSION_CONFIG = {
  tokenType: process.env.SESSION_TOKEN_TYPE || 'opaque', // 'jwt' or 'opaque'
  jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET || 'change-me-in-production',
  accessTokenExpiryMs: parseInt(process.env.ACCESS_TOKEN_EXPIRY_MS || '900000', 10), // 15 minutes
  refreshTokenExpiryMs: parseInt(process.env.REFRESH_TOKEN_EXPIRY_MS || '604800000', 10), // 7 days
  maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '0', 10), // 0 = unlimited
  cleanupIntervalMs: parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS || '3600000', 10), // 1 hour
};

/**
 * Generate a secure opaque token
 */
function generateOpaqueToken(length = 64) {
  return randomBytes(length).toString('hex');
}

/**
 * Hash a token for secure storage
 */
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a JWT token
 */
function generateJWT(payload, expiresInMs) {
  return jwt.sign(payload, SESSION_CONFIG.jwtSecret, {
    expiresIn: Math.floor(expiresInMs / 1000),
    algorithm: 'HS256',
  });
}

/**
 * Verify a JWT token
 */
function verifyJWT(token) {
  try {
    return { valid: true, payload: jwt.verify(token, SESSION_CONFIG.jwtSecret) };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Create a new session with metadata
 */
export async function createSession(userId, metadata = {}) {
  const { ip, userAgent } = metadata;
  
  // Check concurrent session limit
  if (SESSION_CONFIG.maxConcurrentSessions > 0) {
    const activeSessions = await getActiveSessionCount(userId);
    if (activeSessions >= SESSION_CONFIG.maxConcurrentSessions) {
      // Revoke oldest session
      await revokeOldestSession(userId);
    }
  }

  // Generate tokens
  const sessionId = randomBytes(16).toString('hex');
  let accessToken, refreshToken;
  
  if (SESSION_CONFIG.tokenType === 'jwt') {
    accessToken = generateJWT({ userId, sessionId, type: 'access' }, SESSION_CONFIG.accessTokenExpiryMs);
    refreshToken = generateJWT({ userId, sessionId, type: 'refresh' }, SESSION_CONFIG.refreshTokenExpiryMs);
  } else {
    accessToken = generateOpaqueToken();
    refreshToken = generateOpaqueToken();
  }

  const accessTokenHash = hashToken(accessToken);
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + SESSION_CONFIG.refreshTokenExpiryMs);

  await query(
    `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent, last_activity_at) 
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, accessTokenHash, expiresAt, ip || null, userAgent || null],
  );

  // Store refresh token mapping (we'll use the session token field for the primary token)
  // and store refresh token hash in a way that links to the session
  await query(
    'UPDATE sessions SET token = $1 WHERE user_id = $2 AND token = $3',
    [JSON.stringify({ access: accessTokenHash, refresh: refreshTokenHash }), userId, accessTokenHash],
  );

  return {
    accessToken,
    refreshToken,
    expiresAt,
    sessionId,
  };
}

/**
 * Create a simple session (backwards compatible)
 */
export async function createSimpleSession(userId, metadata = {}) {
  const { ip, userAgent } = metadata;
  
  // Check concurrent session limit
  if (SESSION_CONFIG.maxConcurrentSessions > 0) {
    const activeSessions = await getActiveSessionCount(userId);
    if (activeSessions >= SESSION_CONFIG.maxConcurrentSessions) {
      await revokeOldestSession(userId);
    }
  }

  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.session.expiresInMs);

  await query(
    `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent, last_activity_at) 
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, tokenHash, expiresAt, ip || null, userAgent || null],
  );

  return { token, expiresAt };
}

/**
 * Validate a session token
 */
export async function validateSession(token) {
  const tokenHash = hashToken(token);
  
  const result = await query(
    `SELECT s.id, s.user_id, s.expires_at, s.ip_address, s.user_agent, s.last_activity_at, 
            s.is_revoked, s.created_at, u.email, u.role 
     FROM sessions s 
     JOIN users u ON s.user_id = u.id 
     WHERE s.token = $1 AND s.expires_at > NOW() AND (s.is_revoked = FALSE OR s.is_revoked IS NULL)`,
    [tokenHash],
  );

  if (result.rows.length === 0) {
    // Try legacy token format (unhashed)
    const legacyResult = await query(
      `SELECT s.id, s.user_id, s.expires_at, s.ip_address, s.user_agent, s.last_activity_at,
              s.is_revoked, s.created_at, u.email, u.role 
       FROM sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.token = $1 AND s.expires_at > NOW() AND (s.is_revoked = FALSE OR s.is_revoked IS NULL)`,
      [token],
    );
    
    if (legacyResult.rows.length === 0) {
      return { valid: false };
    }
    
    const session = legacyResult.rows[0];
    // Update last activity
    await updateLastActivity(session.id);
    
    return {
      valid: true,
      sessionId: session.id,
      user: { id: session.user_id, email: session.email, role: session.role || 'user' },
      expiresAt: session.expires_at,
      metadata: {
        ip: session.ip_address,
        userAgent: session.user_agent,
        lastActivity: session.last_activity_at,
        createdAt: session.created_at,
      },
    };
  }

  const session = result.rows[0];
  
  // Update last activity
  await updateLastActivity(session.id);

  return {
    valid: true,
    sessionId: session.id,
    user: { id: session.user_id, email: session.email, role: session.role || 'user' },
    expiresAt: session.expires_at,
    metadata: {
      ip: session.ip_address,
      userAgent: session.user_agent,
      lastActivity: session.last_activity_at,
      createdAt: session.created_at,
    },
  };
}

/**
 * Refresh a session - extend expiration
 */
export async function refreshSession(token) {
  const tokenHash = hashToken(token);
  const newExpiresAt = new Date(Date.now() + config.session.expiresInMs);
  
  // Try hashed token first
  let result = await query(
    `UPDATE sessions 
     SET expires_at = $1, last_activity_at = NOW() 
     WHERE token = $2 AND expires_at > NOW() AND (is_revoked = FALSE OR is_revoked IS NULL)
     RETURNING id, user_id, expires_at`,
    [newExpiresAt, tokenHash],
  );

  // Fallback to unhashed token
  if (result.rowCount === 0) {
    result = await query(
      `UPDATE sessions 
       SET expires_at = $1, last_activity_at = NOW() 
       WHERE token = $2 AND expires_at > NOW() AND (is_revoked = FALSE OR is_revoked IS NULL)
       RETURNING id, user_id, expires_at`,
      [newExpiresAt, token],
    );
  }

  if (result.rowCount === 0) {
    return { success: false, error: 'invalid_session' };
  }

  return {
    success: true,
    expiresAt: result.rows[0].expires_at,
  };
}

/**
 * Rotate session token - generate new token for existing session
 */
export async function rotateSessionToken(oldToken) {
  const oldTokenHash = hashToken(oldToken);
  const newToken = generateOpaqueToken();
  const newTokenHash = hashToken(newToken);
  const newExpiresAt = new Date(Date.now() + config.session.expiresInMs);

  // Try hashed token first
  let result = await query(
    `UPDATE sessions 
     SET token = $1, expires_at = $2, last_activity_at = NOW() 
     WHERE token = $3 AND expires_at > NOW() AND (is_revoked = FALSE OR is_revoked IS NULL)
     RETURNING id, user_id, expires_at`,
    [newTokenHash, newExpiresAt, oldTokenHash],
  );

  // Fallback to unhashed token
  if (result.rowCount === 0) {
    result = await query(
      `UPDATE sessions 
       SET token = $1, expires_at = $2, last_activity_at = NOW() 
       WHERE token = $3 AND expires_at > NOW() AND (is_revoked = FALSE OR is_revoked IS NULL)
       RETURNING id, user_id, expires_at`,
      [newTokenHash, newExpiresAt, oldToken],
    );
  }

  if (result.rowCount === 0) {
    return { success: false, error: 'invalid_session' };
  }

  return {
    success: true,
    token: newToken,
    expiresAt: result.rows[0].expires_at,
  };
}

/**
 * Update last activity timestamp
 */
async function updateLastActivity(sessionId) {
  await query(
    'UPDATE sessions SET last_activity_at = NOW() WHERE id = $1',
    [sessionId],
  );
}

/**
 * Get active session count for a user
 */
async function getActiveSessionCount(userId) {
  const result = await query(
    `SELECT COUNT(*) as count FROM sessions 
     WHERE user_id = $1 AND expires_at > NOW() AND (is_revoked = FALSE OR is_revoked IS NULL)`,
    [userId],
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Revoke oldest session for a user
 */
async function revokeOldestSession(userId) {
  await query(
    `UPDATE sessions SET is_revoked = TRUE 
     WHERE id = (
       SELECT id FROM sessions 
       WHERE user_id = $1 AND expires_at > NOW() AND (is_revoked = FALSE OR is_revoked IS NULL)
       ORDER BY created_at ASC 
       LIMIT 1
     )`,
    [userId],
  );
}

/**
 * Get all active sessions for a user
 */
export async function getActiveSessions(userId) {
  const result = await query(
    `SELECT id, ip_address, user_agent, last_activity_at, created_at, expires_at
     FROM sessions 
     WHERE user_id = $1 AND expires_at > NOW() AND (is_revoked = FALSE OR is_revoked IS NULL)
     ORDER BY last_activity_at DESC`,
    [userId],
  );

  return result.rows.map(session => ({
    id: session.id,
    ip: session.ip_address,
    userAgent: session.user_agent,
    lastActivity: session.last_activity_at,
    createdAt: session.created_at,
    expiresAt: session.expires_at,
  }));
}

/**
 * Revoke a specific session by ID
 */
export async function revokeSession(sessionId, userId) {
  const result = await query(
    `UPDATE sessions SET is_revoked = TRUE 
     WHERE id = $1 AND user_id = $2 AND (is_revoked = FALSE OR is_revoked IS NULL)
     RETURNING id`,
    [sessionId, userId],
  );

  return { success: result.rowCount > 0 };
}

/**
 * Revoke session by token
 */
export async function revokeSessionByToken(token) {
  const tokenHash = hashToken(token);
  
  // Try hashed token first
  let result = await query(
    'UPDATE sessions SET is_revoked = TRUE WHERE token = $1 RETURNING id',
    [tokenHash],
  );

  // Fallback to unhashed
  if (result.rowCount === 0) {
    result = await query(
      'UPDATE sessions SET is_revoked = TRUE WHERE token = $1 RETURNING id',
      [token],
    );
  }

  return { success: result.rowCount > 0 };
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllSessions(userId, exceptSessionId = null) {
  let queryText, params;
  
  if (exceptSessionId) {
    queryText = `UPDATE sessions SET is_revoked = TRUE 
                 WHERE user_id = $1 AND id != $2 AND (is_revoked = FALSE OR is_revoked IS NULL)`;
    params = [userId, exceptSessionId];
  } else {
    queryText = `UPDATE sessions SET is_revoked = TRUE 
                 WHERE user_id = $1 AND (is_revoked = FALSE OR is_revoked IS NULL)`;
    params = [userId];
  }

  const result = await query(queryText, params);
  return { success: true, count: result.rowCount };
}

/**
 * Cleanup expired and revoked sessions
 */
export async function cleanupExpiredSessions() {
  const result = await query(
    'DELETE FROM sessions WHERE expires_at < NOW() OR is_revoked = TRUE',
  );
  return { deleted: result.rowCount };
}

/**
 * Start periodic session cleanup
 */
let cleanupInterval = null;

export function startSessionCleanup() {
  if (cleanupInterval) {
    return; // Already running
  }
  
  cleanupInterval = setInterval(async () => {
    try {
      const result = await cleanupExpiredSessions();
      if (result.deleted > 0) {
        console.log(`Session cleanup: removed ${result.deleted} expired/revoked sessions`);
      }
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }, SESSION_CONFIG.cleanupIntervalMs);
  
  console.log(`Session cleanup scheduled every ${SESSION_CONFIG.cleanupIntervalMs / 1000}s`);
}

export function stopSessionCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get session configuration
 */
export function getSessionConfig() {
  return {
    tokenType: SESSION_CONFIG.tokenType,
    accessTokenExpiryMs: SESSION_CONFIG.accessTokenExpiryMs,
    refreshTokenExpiryMs: SESSION_CONFIG.refreshTokenExpiryMs,
    maxConcurrentSessions: SESSION_CONFIG.maxConcurrentSessions,
  };
}
