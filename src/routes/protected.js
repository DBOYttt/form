/**
 * Protected Routes
 * Routes that require authentication and may require specific roles
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { query } from '../db.js';
import bcrypt from 'bcrypt';
import { config } from '../config.js';

const router = express.Router();

// All routes in this file require authentication
router.use(authenticate);

/**
 * GET /api/me
 * Get current user's profile
 */
router.get('/me', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, role, email_verified, created_at, updated_at 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User not found.',
      });
    }

    const user = result.rows[0];
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while fetching profile.',
    });
  }
});

/**
 * PUT /api/me
 * Update current user's profile
 */
router.put('/me', async (req, res) => {
  try {
    const { email } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email && email !== req.user.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Please provide a valid email address.',
        });
      }

      // Check if email is already taken
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), req.user.id]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: 'email_taken',
          message: 'This email address is already in use.',
        });
      }

      updates.push(`email = $${paramIndex}`);
      values.push(email.toLowerCase());
      paramIndex++;

      // Reset email verification when email changes
      updates.push(`email_verified = false`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'no_changes',
        message: 'No valid fields to update.',
      });
    }

    values.push(req.user.id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramIndex} 
       RETURNING id, email, role, email_verified, created_at, updated_at`,
      values
    );

    const user = result.rows[0];
    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while updating profile.',
    });
  }
});

/**
 * POST /api/me/change-password
 * Change current user's password
 */
router.post('/me/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Current password, new password, and confirmation are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'New password and confirmation do not match.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Password must be at least 8 characters long.',
      });
    }

    // Verify current password
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User not found.',
      });
    }

    const validPassword = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: 'invalid_password',
        message: 'Current password is incorrect.',
      });
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, req.user.id]
    );

    // Optionally invalidate all other sessions
    if (config.passwordReset?.invalidateSessionsOnPasswordReset) {
      await query(
        'DELETE FROM sessions WHERE user_id = $1 AND token != $2',
        [req.user.id, req.sessionToken]
      );
    }

    return res.status(200).json({
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while changing password.',
    });
  }
});

/**
 * GET /api/me/sessions
 * Get all active sessions for current user
 */
router.get('/me/sessions', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, created_at, expires_at,
              CASE WHEN token = $1 THEN true ELSE false END as current
       FROM sessions 
       WHERE user_id = $2 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.sessionToken, req.user.id]
    );

    return res.status(200).json({
      sessions: result.rows.map(session => ({
        id: session.id,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        current: session.current,
      })),
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while fetching sessions.',
    });
  }
});

/**
 * DELETE /api/me/sessions/:sessionId
 * Revoke a specific session
 */
router.delete('/me/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await query(
      'DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Session not found.',
      });
    }

    return res.status(200).json({
      message: 'Session revoked successfully.',
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while revoking session.',
    });
  }
});

/**
 * DELETE /api/me
 * Delete current user's account
 */
router.delete('/me', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Password is required to delete account.',
      });
    }

    // Verify password
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User not found.',
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      userResult.rows[0].password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: 'invalid_password',
        message: 'Password is incorrect.',
      });
    }

    // Delete user (cascades to sessions and tokens)
    await query('DELETE FROM users WHERE id = $1', [req.user.id]);

    return res.status(200).json({
      message: 'Account deleted successfully.',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while deleting account.',
    });
  }
});

// ============================================
// Admin-only routes
// ============================================

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
router.get('/admin/users', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [usersResult, countResult] = await Promise.all([
      query(
        `SELECT id, email, role, email_verified, created_at, updated_at 
         FROM users 
         ORDER BY created_at DESC 
         LIMIT $1 OFFSET $2`,
        [parseInt(limit, 10), offset]
      ),
      query('SELECT COUNT(*) as total FROM users'),
    ]);

    return res.status(200).json({
      users: usersResult.rows.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countResult.rows[0].total, 10),
        totalPages: Math.ceil(countResult.rows[0].total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while fetching users.',
    });
  }
});

/**
 * PUT /api/admin/users/:userId/role
 * Update user's role (admin only)
 */
router.put('/admin/users/:userId/role', requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['user', 'moderator', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        error: 'validation_error',
        message: `Role must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Prevent admin from demoting themselves
    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'self_modification',
        message: 'You cannot change your own role.',
      });
    }

    const result = await query(
      `UPDATE users SET role = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, email, role`,
      [role, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      message: 'User role updated successfully.',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while updating user role.',
    });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user (admin only)
 */
router.delete('/admin/users/:userId', requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'self_deletion',
        message: 'You cannot delete your own account via admin API.',
      });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      message: 'User deleted successfully.',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred while deleting user.',
    });
  }
});

export default router;
