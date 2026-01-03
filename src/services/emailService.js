import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }
  return transporter;
}

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetToken - Plain reset token (unhashed)
 * @returns {Promise<void>}
 */
export async function sendPasswordResetEmail(to, resetToken) {
  const resetUrl = `${config.baseUrl}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: config.email.from,
    to,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click the following link to reset your password:\n\n${resetUrl}\n\nThis link will expire in ${config.passwordReset.tokenExpirationHours} hour(s).\n\nIf you did not request this reset, please ignore this email.`,
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
          Reset Password
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in ${config.passwordReset.tokenExpirationHours} hour(s).</p>
      <p><small>If you did not request this reset, please ignore this email.</small></p>
    `,
  };

  await getTransporter().sendMail(mailOptions);
}
