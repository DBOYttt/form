import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;

/**
 * Initialize email transporter
 */
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: config.email.user ? {
        user: config.email.user,
        pass: config.email.password,
      } : undefined,
    });
  }
  return transporter;
}

/**
 * Send verification email to user
 * @param {string} to - Recipient email
 * @param {string} token - Verification token
 * @returns {Promise<void>}
 */
export async function sendVerificationEmail(to, token) {
  const verificationLink = `${config.baseUrl}/auth/verify-email?token=${token}`;
  
  const mailOptions = {
    from: config.email.from,
    to,
    subject: 'Verify your email address',
    text: `Welcome! Please verify your email address by clicking the following link:\n\n${verificationLink}\n\nThis link will expire in ${config.verificationTokenExpiry} hours.\n\nIf you did not create an account, please ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Welcome!</h1>
        <p>Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${verificationLink}" style="color: #2563eb;">${verificationLink}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          This link will expire in ${config.verificationTokenExpiry} hours.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          If you did not create an account, please ignore this email.
        </p>
      </body>
      </html>
    `,
  };
  
  try {
    await getTransporter().sendMail(mailOptions);
    console.log(`Verification email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}
