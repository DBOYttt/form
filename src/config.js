/**
 * Application configuration
 */
export const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'auth_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  
  // Email
  email: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@example.com',
  },
  
  // Application
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  
  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  verificationTokenExpiry: parseInt(process.env.VERIFICATION_TOKEN_EXPIRY_HOURS || '24', 10),

  // Session settings
  session: {
    tokenLength: 64,
    expiresInMs: parseInt(process.env.SESSION_EXPIRY_MS || '86400000', 10), // 24 hours default
    tokenType: process.env.SESSION_TOKEN_TYPE || 'opaque', // 'jwt' or 'opaque'
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '0', 10), // 0 = unlimited
    cleanupIntervalMs: parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS || '3600000', 10), // 1 hour
  },

  // JWT settings (if using JWT tokens)
  jwt: {
    secret: process.env.JWT_SECRET || process.env.SESSION_SECRET || 'change-me-in-production',
    accessTokenExpiryMs: parseInt(process.env.ACCESS_TOKEN_EXPIRY_MS || '900000', 10), // 15 minutes
    refreshTokenExpiryMs: parseInt(process.env.REFRESH_TOKEN_EXPIRY_MS || '604800000', 10), // 7 days
  },

  // Rate limiting for login attempts
  rateLimit: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDurationMs: 30 * 60 * 1000, // 30 minutes lockout
  },
  
  // Password reset settings
  passwordReset: {
    tokenExpirationHours: 1,
    tokenLength: 32,
    invalidateSessionsOnPasswordReset: true,
  },
};
