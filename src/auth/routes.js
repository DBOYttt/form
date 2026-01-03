import express from 'express';
import { registerUser, verifyEmail, resendVerificationEmail } from './registration.js';
import * as authService from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { validateEmail } from '../utils/validation.js';

const router = express.Router();

/**
 * POST /auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
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
router.post('/resend-verification', async (req, res) => {
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
router.post('/login', async (req, res) => {
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

    // Get client IP for rate limiting
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    const result = await authService.login(email, password, ip);

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
    });
  } catch (error) {
    console.error('Session check error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while checking session.',
    });
  }
});

export default router;
