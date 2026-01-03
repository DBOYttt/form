import express from 'express';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import authRoutes from './auth/routes.js';
import passwordResetRoutes from './routes/passwordReset.js';
import protectedRoutes from './routes/protected.js';
import { cors } from './middleware/cors.js';
import pool from './db.js';
import { startSessionCleanup, cleanupExpiredSessions } from './services/sessionService.js';
import passwordResetService from './services/passwordResetService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Get local network IP addresses
 */
function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  return addresses;
}

/**
 * Print startup banner
 */
function printStartupBanner(port, host) {
  const divider = '═'.repeat(60);
  const isDevMode = config.devMode?.enabled;
  
  console.log(`
${colors.cyan}${divider}${colors.reset}
${colors.bright}${colors.green}🚀 Authentication Service Started${colors.reset}
${colors.cyan}${divider}${colors.reset}
`);

  // URLs
  console.log(`${colors.bright}Access URLs:${colors.reset}`);
  console.log(`   ${colors.cyan}Local:${colors.reset}   http://localhost:${port}`);
  
  if (host === '0.0.0.0') {
    const networkAddresses = getNetworkAddresses();
    networkAddresses.forEach(addr => {
      console.log(`   ${colors.cyan}Network:${colors.reset} http://${addr}:${port}`);
    });
  }
  
  console.log(`   ${colors.cyan}Mode:${colors.reset}    ${config.nodeEnv}`);
  console.log();

  // Dev mode warnings
  if (isDevMode) {
    console.log(`${colors.bright}${colors.yellow}⚠️  DEVELOPMENT MODE - NOT FOR PRODUCTION${colors.reset}`);
    console.log(`${colors.yellow}${'─'.repeat(60)}${colors.reset}`);
    
    const devSettings = [];
    if (config.devMode.skipEmailVerification) devSettings.push('Email verification SKIPPED');
    if (config.devMode.mockEmail) devSettings.push('Emails logged to console (not sent)');
    if (config.devMode.relaxedSecurity) devSettings.push('Relaxed password requirements (min 4 chars)');
    if (config.rateLimit?.disabled) devSettings.push('Rate limiting DISABLED');
    if (config.devMode.relaxedSecurity) devSettings.push('CORS allows all origins');
    if (config.devMode.verboseErrors) devSettings.push('Verbose error messages with stack traces');
    
    devSettings.forEach(setting => {
      console.log(`   ${colors.yellow}• ${setting}${colors.reset}`);
    });
    
    console.log();
    console.log(`${colors.bright}Test Users:${colors.reset} (create with seed-db script)`);
    console.log(`   ${colors.dim}test@example.com / password123 (verified)${colors.reset}`);
    console.log(`   ${colors.dim}unverified@example.com / password123 (unverified)${colors.reset}`);
    console.log();
  }

  console.log(`${colors.cyan}${divider}${colors.reset}`);
  console.log();
}

/**
 * Color-coded request logger
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    let statusColor = colors.green;
    if (status >= 400) statusColor = colors.yellow;
    if (status >= 500) statusColor = colors.red;
    
    const methodColors = {
      GET: colors.cyan,
      POST: colors.green,
      PUT: colors.yellow,
      PATCH: colors.yellow,
      DELETE: colors.red,
    };
    
    const methodColor = methodColors[req.method] || colors.reset;
    
    console.log(
      `${colors.dim}${new Date().toISOString()}${colors.reset} ` +
      `${methodColor}${req.method.padEnd(7)}${colors.reset} ` +
      `${req.path} ` +
      `${statusColor}${status}${colors.reset} ` +
      `${colors.dim}${duration}ms${colors.reset}`,
    );
  });
  
  next();
}

const app = express();

// Security middleware
app.disable('x-powered-by');

// CORS middleware - must be before other middleware
app.use(cors());

// Schedule cleanup jobs (every hour)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let cleanupInterval = null;

function startCleanupJobs() {
  cleanupInterval = setInterval(async () => {
    try {
      const sessionResult = await cleanupExpiredSessions();
      const tokenResult = await passwordResetService.cleanupExpiredTokens();
      if (config.nodeEnv === 'development') {
        console.log(`${colors.dim}Cleanup: ${sessionResult.deleted} sessions, ${tokenResult} tokens removed${colors.reset}`);
      }
    } catch (error) {
      console.error('Cleanup job error:', error);
    }
  }, CLEANUP_INTERVAL_MS);
  
  // Don't prevent process from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

// Body parsing with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Trust proxy for accurate IP detection (for rate limiting)
app.set('trust proxy', 1);

// Request logging in development
if (config.nodeEnv === 'development' || config.devMode?.enabled) {
  app.use(requestLogger);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    devMode: config.devMode?.enabled || false,
  });
});

// Auth routes (rate limiting handled by individual route middleware)
app.use('/auth', authRoutes);

// Password reset API routes
app.use('/api/auth', passwordResetRoutes);

// Protected API routes (profile, settings, admin)
app.use('/api', protectedRoutes);

// Serve HTML pages for password reset
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'reset-password.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'The requested endpoint does not exist.',
  });
});

// Error handler with verbose errors in dev mode
app.use((err, req, res, _next) => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, err);
  
  const response = {
    error: 'server_error',
    message: 'An unexpected error occurred.',
  };
  
  // Include stack trace in dev mode
  if (config.devMode?.verboseErrors) {
    response.message = err.message;
    response.stack = err.stack;
    response.details = err.details || undefined;
  }
  
  res.status(500).json(response);
});

// Graceful shutdown
let server;
if (import.meta.url === `file://${process.argv[1]}`) {
  startCleanupJobs();
  const host = config.host || '0.0.0.0';
  server = app.listen(config.port, host, () => {
    printStartupBanner(config.port, host);
    
    // Start automatic session cleanup (uses sessionService)
    startSessionCleanup();
    
    // Schedule periodic cleanup of expired password reset tokens
    const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    setInterval(async () => {
      try {
        const tokensDeleted = await passwordResetService.cleanupExpiredTokens();
        if (config.nodeEnv === 'development') {
          console.log(`${colors.dim}Token cleanup: ${tokensDeleted} expired tokens removed${colors.reset}`);
        }
      } catch (error) {
        console.error('Token cleanup error:', error);
      }
    }, TOKEN_CLEANUP_INTERVAL);
  });
}

const shutdown = async (signal) => {
  console.log(`\n${colors.yellow}${signal} received, shutting down gracefully...${colors.reset}`);
  if (server) {
    server.close(() => {
      console.log(`${colors.dim}HTTP server closed${colors.reset}`);
    });
  }
  await pool.end();
  console.log(`${colors.dim}Database pool closed${colors.reset}`);
  console.log(`${colors.green}Goodbye! 👋${colors.reset}`);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
