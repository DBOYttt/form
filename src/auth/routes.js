import express from 'express';
import { registerUser, verifyEmail, resendVerificationEmail } from './registration.js';
import * as authService from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { validateEmail } from '../utils/validation.js';
import { authRateLimit, strictRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

/**
 * POST /auth/register
 * Register a new user account
 */
router.post('/register', strictRateLimit(), async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;
    
    const result = await registerUser({ email, password, confirmPassword });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }
    
    return res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error('Registration endpoint error:', error);
    return res.status(500).json({
      success: false,
      errors: ['An unexpected error occurred. Please try again later.'],
    });
  }
});

/**
 * GET /auth/verify-email
 * Verify email address with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
    }
    
    const result = await verifyEmail(token);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Email verification endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * POST /auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', strictRateLimit(), async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }
    
    const result = await resendVerificationEmail(email);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Resend verification endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', authRateLimit(), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Email and password are required.',
      });
    }

    // Email format validation using shared validator
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        error: 'validation_error',
        message: emailValidation.error,
      });
    }

    // Get client IP and user agent for session metadata
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || null;

    const result = await authService.login(email, password, ip, userAgent);

    if (!result.success) {
      const statusCode = result.error === 'rate_limited' ? 429 : 401;
      return res.status(statusCode).json({
        error: result.error,
        message: result.message,
      });
    }

    return res.status(200).json({
      message: 'Login successful.',
      user: result.user,
      token: result.session.token,
      expiresAt: result.session.expiresAt,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred during login. Please try again.',
    });
  }
});

/**
 * POST /auth/logout
 * Logout current session
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const result = await authService.logout(req.sessionToken);

    if (!result.success) {
      return res.status(400).json({
        error: 'logout_failed',
        message: 'Unable to logout. Session may already be invalid.',
      });
    }

    return res.status(200).json({
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred during logout. Please try again.',
    });
  }
});

/**
 * POST /auth/logout-all
 * Logout all sessions for the current user
 */
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    const result = await authService.logoutAll(req.user.id);

    return res.status(200).json({
      message: `Successfully logged out of ${result.count} session(s).`,
    });
  } catch (error) {
    console.error('Logout all error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred during logout. Please try again.',
    });
  }
});

/**
 * GET /auth/session
 * Get current session information
 */
router.get('/session', authenticate, async (req, res) => {
  try {
    const session = await authService.validateSession(req.sessionToken);

    return res.status(200).json({
      user: session.user,
      expiresAt: session.expiresAt,
      metadata: session.metadata,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while checking session.',
    });
  }
});

/**
 * GET /auth/sessions
 * List all active sessions for the current user
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await authService.getActiveSessions(req.user.id);

    return res.status(200).json({
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('List sessions error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while listing sessions.',
    });
  }
});

/**
 * DELETE /auth/sessions/:sessionId
 * Revoke a specific session
 */
router.delete('/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await authService.revokeSession(sessionId, req.user.id);

    if (!result.success) {
      return res.status(404).json({
        error: 'session_not_found',
        message: 'Session not found or already revoked.',
      });
    }

    return res.status(200).json({
      message: 'Session revoked successfully.',
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while revoking the session.',
    });
  }
});

/**
 * POST /auth/session/refresh
 * Refresh current session - extend expiration
 */
router.post('/session/refresh', authenticate, async (req, res) => {
  try {
    const result = await authService.refreshSession(req.sessionToken);

    if (!result.success) {
      return res.status(400).json({
        error: 'refresh_failed',
        message: 'Unable to refresh session.',
      });
    }

    return res.status(200).json({
      message: 'Session refreshed successfully.',
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while refreshing the session.',
    });
  }
});

/**
 * POST /auth/session/rotate
 * Rotate session token - get a new token for the current session
 */
router.post('/session/rotate', authenticate, async (req, res) => {
  try {
    const result = await authService.rotateSessionToken(req.sessionToken);

    if (!result.success) {
      return res.status(400).json({
        error: 'rotation_failed',
        message: 'Unable to rotate session token.',
      });
    }

    return res.status(200).json({
      message: 'Session token rotated successfully.',
      token: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Session rotation error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while rotating the session token.',
    });
  }
});

export default router;
