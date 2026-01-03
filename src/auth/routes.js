import express from 'express';
import { registerUser, verifyEmail, resendVerificationEmail } from './registration.js';

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

export default router;
