/**
 * Mock Email Service for Development
 * Logs emails to console and optionally saves to files
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

/**
 * Format email for console display
 */
function formatEmailForConsole(emailData) {
  const divider = '═'.repeat(60);
  const thinDivider = '─'.repeat(60);
  
  return `
${colors.cyan}${divider}${colors.reset}
${colors.bright}${colors.yellow}📧 MOCK EMAIL - DEV MODE${colors.reset}
${colors.cyan}${divider}${colors.reset}
${colors.bright}From:${colors.reset}    ${emailData.from}
${colors.bright}To:${colors.reset}      ${emailData.to}
${colors.bright}Subject:${colors.reset} ${emailData.subject}
${colors.cyan}${thinDivider}${colors.reset}
${colors.dim}${emailData.text}${colors.reset}
${colors.cyan}${thinDivider}${colors.reset}
${emailData.links?.length ? `${colors.bright}${colors.green}🔗 Clickable Links:${colors.reset}\n${emailData.links.map(l => `   ${colors.blue}${l}${colors.reset}`).join('\n')}` : ''}
${colors.cyan}${divider}${colors.reset}
`;
}

/**
 * Extract URLs from text
 */
function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
  return text.match(urlRegex) || [];
}

/**
 * Save email to file
 */
async function saveEmailToFile(emailData) {
  const dir = config.devMode.devEmailsDir;
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${emailData.to.replace(/[^a-z0-9]/gi, '_')}.json`;
    const filepath = path.join(dir, filename);
    
    const fileContent = {
      ...emailData,
      timestamp: new Date().toISOString(),
    };
    
    fs.writeFileSync(filepath, JSON.stringify(fileContent, null, 2));
    console.log(`${colors.dim}Email saved to: ${filepath}${colors.reset}`);
  } catch (error) {
    console.error('Failed to save email to file:', error.message);
  }
}

/**
 * Mock send email - logs to console instead of sending
 */
export async function mockSendMail(mailOptions) {
  const emailData = {
    from: mailOptions.from,
    to: mailOptions.to,
    subject: mailOptions.subject,
    text: mailOptions.text,
    html: mailOptions.html,
    links: extractUrls(mailOptions.text || ''),
  };
  
  // Log to console
  console.log(formatEmailForConsole(emailData));
  
  // Optionally save to file
  if (config.devMode.saveEmailsToFile) {
    await saveEmailToFile(emailData);
  }
  
  return { messageId: `mock-${Date.now()}` };
}

/**
 * Log verification token to console
 */
export function logVerificationToken(email, token, verificationLink) {
  console.log(`
${colors.cyan}${'═'.repeat(60)}${colors.reset}
${colors.bright}${colors.yellow}🔑 VERIFICATION TOKEN - DEV MODE${colors.reset}
${colors.cyan}${'═'.repeat(60)}${colors.reset}
${colors.bright}Email:${colors.reset} ${email}
${colors.bright}Token:${colors.reset} ${token}
${colors.bright}${colors.green}Link:${colors.reset}  ${colors.blue}${verificationLink}${colors.reset}
${colors.cyan}${'═'.repeat(60)}${colors.reset}
`);
}

/**
 * Log password reset token to console
 */
export function logPasswordResetToken(email, token, resetLink) {
  console.log(`
${colors.cyan}${'═'.repeat(60)}${colors.reset}
${colors.bright}${colors.yellow}🔐 PASSWORD RESET TOKEN - DEV MODE${colors.reset}
${colors.cyan}${'═'.repeat(60)}${colors.reset}
${colors.bright}Email:${colors.reset} ${email}
${colors.bright}Token:${colors.reset} ${token}
${colors.bright}${colors.green}Link:${colors.reset}  ${colors.blue}${resetLink}${colors.reset}
${colors.cyan}${'═'.repeat(60)}${colors.reset}
`);
}
