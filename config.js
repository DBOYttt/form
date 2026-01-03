/**
 * Centralized Configuration Loader
 * Loads and validates environment variables for the authentication system
 */

const path = require('path');

// Load .env file if it exists
try {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
    // dotenv not installed, environment variables should be set externally
}

/**
 * Validates that required environment variables are set
 * @param {string[]} required - Array of required variable names
 * @throws {Error} If any required variables are missing
 */
function validateRequired(required) {
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n` +
            `Please copy .env.example to .env and configure these values.`
        );
    }
}

/**
 * Get environment variable with optional default
 * @param {string} key - Variable name
 * @param {string} [defaultValue] - Default value if not set
 * @returns {string}
 */
function getEnv(key, defaultValue) {
    return process.env[key] || defaultValue;
}

/**
 * Get numeric environment variable
 * @param {string} key - Variable name
 * @param {number} defaultValue - Default value
 * @returns {number}
 */
function getEnvInt(key, defaultValue) {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get boolean environment variable
 * @param {string} key - Variable name
 * @param {boolean} defaultValue - Default value
 * @returns {boolean}
 */
function getEnvBool(key, defaultValue) {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}

// Required variables for production
const REQUIRED_VARS = [
    'DATABASE_URL',
    'SESSION_SECRET'
];

// Additional required vars for email functionality
const EMAIL_REQUIRED_VARS = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS'
];

// Validate required variables (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
    validateRequired(REQUIRED_VARS);
}

/**
 * Application configuration object
 */
const config = {
    // Environment
    env: getEnv('NODE_ENV', 'development'),
    isDevelopment: getEnv('NODE_ENV', 'development') === 'development',
    isProduction: getEnv('NODE_ENV') === 'production',
    isTest: getEnv('NODE_ENV') === 'test',

    // Server
    port: getEnvInt('PORT', 3000),
    appUrl: getEnv('APP_URL', 'http://localhost:3000'),
    appName: getEnv('APP_NAME', 'Authentication System'),

    // Database
    database: {
        url: getEnv('DATABASE_URL'),
        poolSize: getEnvInt('DB_POOL_SIZE', 10)
    },

    // Session
    session: {
        secret: getEnv('SESSION_SECRET'),
        expirySeconds: getEnvInt('SESSION_EXPIRY', 86400) // 24 hours
    },

    // Email/SMTP
    email: {
        host: getEnv('SMTP_HOST'),
        port: getEnvInt('SMTP_PORT', 587),
        user: getEnv('SMTP_USER'),
        pass: getEnv('SMTP_PASS'),
        from: getEnv('SMTP_FROM', 'noreply@example.com'),
        secure: getEnvBool('SMTP_SECURE', false)
    },

    // Token Expiry (in seconds)
    tokens: {
        passwordReset: getEnvInt('PASSWORD_RESET_EXPIRY', 3600), // 1 hour
        emailVerification: getEnvInt('EMAIL_VERIFICATION_EXPIRY', 86400) // 24 hours
    },

    // Security
    security: {
        bcryptRounds: getEnvInt('BCRYPT_ROUNDS', 12),
        rateLimitWindowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
        rateLimitMaxRequests: getEnvInt('RATE_LIMIT_MAX_REQUESTS', 100)
    },

    /**
     * Validate email configuration is complete
     * @returns {boolean}
     */
    isEmailConfigured() {
        return !!(this.email.host && this.email.port && this.email.user && this.email.pass);
    },

    /**
     * Validate all required configuration
     * @throws {Error} If configuration is invalid
     */
    validate() {
        validateRequired(REQUIRED_VARS);
        
        if (this.session.secret.length < 32) {
            throw new Error('SESSION_SECRET must be at least 32 characters long');
        }
        
        if (this.isProduction && !this.isEmailConfigured()) {
            console.warn('WARNING: Email is not configured. Password reset and email verification will not work.');
        }
        
        return true;
    }
};

module.exports = config;
