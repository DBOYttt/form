import bcrypt from 'bcrypt';
import { timingSafeEqual } from 'crypto';
import { query, getClient } from '../db.js';
import { config } from '../config.js';
import { generateToken, getTokenExpiration } from '../utils/token.js';
import { validateRegistrationInput, validateEmail } from '../utils/validation.js';
import { sendVerificationEmail } from '../email/mailer.js';

/**
 * Register a new user
 * @param {{ email: string, password: string, confirmPassword: string }} input
 * @returns {Promise<{ success: boolean, user?: { id: string, email: string }, errors?: string[] }>}
 */
export async function registerUser({ email, password, confirmPassword }) {
  // Validate input
  const validation = validateRegistrationInput({ email, password, confirmPassword });
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  
  // Check if email already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [normalizedEmail],
  );
  
  if (existingUser.rows.length > 0) {
    return { success: false, errors: ['An account with this email already exists'] };
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  
  // In dev mode with skip email verification, auto-verify users
  const autoVerify = config.devMode?.skipEmailVerification;
  
  // Generate verification token (still generate even if auto-verifying for logging)
  const verificationToken = generateToken();
  const tokenExpiration = getTokenExpiration(config.verificationTokenExpiry);
  
  // Use transaction to create user and verification token
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Create user (auto-verified in dev mode)
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, email_verified)
       VALUES ($1, $2, $3)
       RETURNING id, email, email_verified, created_at`,
      [normalizedEmail, passwordHash, autoVerify],
    );
    
    const user = userResult.rows[0];
    
    // Create verification token (unless auto-verified)
    if (!autoVerify) {
      await client.query(
        `INSERT INTO email_verification_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, verificationToken, tokenExpiration],
      );
    }
    
    await client.query('COMMIT');
    
    // Handle email sending / logging
    if (autoVerify) {
      console.log(`\x1b[33m⚠️  DEV MODE: User ${normalizedEmail} auto-verified (SKIP_EMAIL_VERIFICATION=true)\x1b[0m`);
    } else {
      // Send verification email (don't fail registration if email fails)
      try {
        await sendVerificationEmail(normalizedEmail, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // User is still created, they can request a new verification email later
      }
    }
    
    const message = autoVerify
      ? 'Registration successful. Your account is ready to use (dev mode - email verification skipped).'
      : 'Registration successful. Please check your email to verify your account.';
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: autoVerify,
      },
      message,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    
    // Handle unique constraint violation (race condition)
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return { success: false, errors: ['An account with this email already exists'] };
    }
    
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify user email with token
 * @param {string} token
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verifyEmail(token) {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'Verification token is required' };
  }
  
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Find all non-expired tokens and compare in constant time
    const tokenResult = await client.query(
      `SELECT evt.id, evt.user_id, evt.token, u.email_verified
       FROM email_verification_tokens evt
       JOIN users u ON u.id = evt.user_id
       WHERE evt.expires_at > NOW()`,
    );
    
    // Timing-safe comparison
    let matchedToken = null;
    const tokenBuffer = Buffer.from(token);
    for (const row of tokenResult.rows) {
      const storedBuffer = Buffer.from(row.token);
      if (tokenBuffer.length === storedBuffer.length && 
          timingSafeEqual(tokenBuffer, storedBuffer)) {
        matchedToken = row;
        break;
      }
    }
    
    if (!matchedToken) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Invalid or expired verification token' };
    }
    
    const { user_id, email_verified } = matchedToken;
    
    if (email_verified) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Email is already verified' };
    }
    
    // Update user as verified
    await client.query(
      'UPDATE users SET email_verified = true WHERE id = $1',
      [user_id],
    );
    
    // Delete used verification token
    await client.query(
      'DELETE FROM email_verification_tokens WHERE user_id = $1',
      [user_id],
    );
    
    await client.query('COMMIT');
    
    return { success: true, message: 'Email verified successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Email verification error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Resend verification email
 * @param {string} email
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function resendVerificationEmail(email) {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.error };
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  
  // Find user
  const userResult = await query(
    'SELECT id, email_verified FROM users WHERE email = $1',
    [normalizedEmail],
  );
  
  if (userResult.rows.length === 0) {
    // Don't reveal if email exists
    return { success: true, message: 'If an account exists, a verification email has been sent' };
  }
  
  const user = userResult.rows[0];
  
  if (user.email_verified) {
    return { success: false, error: 'Email is already verified' };
  }
  
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Delete existing tokens
    await client.query(
      'DELETE FROM email_verification_tokens WHERE user_id = $1',
      [user.id],
    );
    
    // Create new token
    const verificationToken = generateToken();
    const tokenExpiration = getTokenExpiration(config.verificationTokenExpiry);
    
    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, verificationToken, tokenExpiration],
    );
    
    await client.query('COMMIT');
    
    // Send email
    await sendVerificationEmail(normalizedEmail, verificationToken);
    
    return { success: true, message: 'Verification email sent' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Resend verification error:', error);
    throw error;
  } finally {
    client.release();
  }
}
