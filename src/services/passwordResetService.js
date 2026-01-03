import bcrypt from 'bcrypt';
import { query, getClient } from '../db.js';
import { config } from '../config.js';
import { generateToken, hashToken } from '../utils/token.js';
import { sendPasswordResetEmail } from '../email/mailer.js';
import { validatePassword, validatePasswordMatch } from '../utils/validation.js';

class PasswordResetService {
  /**
   * Initiate password reset process
   * @param {string} email - User's email address
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async requestPasswordReset(email) {
    // Always return success to prevent email enumeration attacks
    const successResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    try {
      // Find user by email
      const userResult = await query(
        'SELECT id, email FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );

      if (userResult.rows.length === 0) {
        // User not found - return success anyway to prevent enumeration
        return successResponse;
      }

      const user = userResult.rows[0];

      // Invalidate any existing unused reset tokens for this user
      await query(
        'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
        [user.id]
      );

      // Generate secure token
      const plainToken = generateToken(config.passwordReset.tokenLength);
      const hashedToken = hashToken(plainToken);

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + config.passwordReset.tokenExpirationHours);

      // Store hashed token in database
      await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at, used)
         VALUES ($1, $2, $3, FALSE)`,
        [user.id, hashedToken, expiresAt]
      );

      // Send email with plain token
      await sendPasswordResetEmail(user.email, plainToken);

      return successResponse;
    } catch (error) {
      console.error('Password reset request error:', error);
      throw new Error('Failed to process password reset request');
    }
  }

  /**
   * Validate a password reset token
   * @param {string} token - Plain reset token from URL
   * @returns {Promise<{valid: boolean, userId?: string, error?: string}>}
   */
  async validateResetToken(token) {
    if (!token) {
      return { valid: false, error: 'Token is required' };
    }

    try {
      const hashedToken = hashToken(token);

      const result = await query(
        `SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
         WHERE prt.token = $1`,
        [hashedToken]
      );

      if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid or expired reset token' };
      }

      const tokenRecord = result.rows[0];

      // Check if token has been used
      if (tokenRecord.used) {
        return { valid: false, error: 'This reset token has already been used' };
      }

      // Check if token has expired
      if (new Date(tokenRecord.expires_at) < new Date()) {
        return { valid: false, error: 'This reset token has expired' };
      }

      return {
        valid: true,
        userId: tokenRecord.user_id,
        email: tokenRecord.email,
        tokenId: tokenRecord.id,
      };
    } catch (error) {
      console.error('Token validation error:', error);
      throw new Error('Failed to validate reset token');
    }
  }

  /**
   * Reset user's password
   * @param {string} token - Plain reset token
   * @param {string} newPassword - New password
   * @param {string} confirmPassword - Password confirmation
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async resetPassword(token, newPassword, confirmPassword) {
    // Validate passwords match
    const matchValidation = validatePasswordMatch(newPassword, confirmPassword);
    if (!matchValidation.valid) {
      return { success: false, error: 'validation_error', message: matchValidation.error };
    }

    // Validate password strength using shared validation
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return { success: false, error: 'validation_error', message: passwordValidation.error };
    }

    // Validate token
    const tokenValidation = await this.validateResetToken(token);
    if (!tokenValidation.valid) {
      return { success: false, error: 'invalid_token', message: tokenValidation.error };
    }

    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);

      // Update user's password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, tokenValidation.userId]
      );

      // Mark token as used
      await client.query(
        'UPDATE password_reset_tokens SET used = TRUE WHERE token = $1',
        [hashToken(token)]
      );

      // Invalidate all existing sessions for security
      if (config.passwordReset.invalidateSessionsOnPasswordReset) {
        await client.query(
          'DELETE FROM sessions WHERE user_id = $1',
          [tokenValidation.userId]
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Password reset error:', error);
      throw new Error('Failed to reset password');
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired tokens (for scheduled job)
   * @returns {Promise<number>} Number of deleted tokens
   */
  async cleanupExpiredTokens() {
    try {
      const result = await query(
        'DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE'
      );
      return result.rowCount;
    } catch (error) {
      console.error('Token cleanup error:', error);
      throw new Error('Failed to cleanup expired tokens');
    }
  }
}

export default new PasswordResetService();
