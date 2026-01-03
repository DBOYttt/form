import express from 'express';
import passwordResetService from '../services/passwordResetService.js';

const router = express.Router();

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const result = await passwordResetService.requestPasswordReset(email);
    return res.json(result);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request',
    });
  }
});

/**
 * GET /api/auth/reset-password/validate
 * Validate a reset token (for checking before showing reset form)
 */
router.get('/reset-password/validate', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        valid: false,
        error: 'Token is required',
      });
    }

    const result = await passwordResetService.validateResetToken(token);
    
    if (!result.valid) {
      return res.status(400).json({
        valid: false,
        error: result.error,
      });
    }

    return res.json({
      valid: true,
      email: result.email,
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({
      valid: false,
      error: 'An error occurred while validating the token',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required',
      });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation are required',
      });
    }

    const result = await passwordResetService.resetPassword(token, newPassword, confirmPassword);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while resetting your password',
    });
  }
});

export default router;
