import express from 'express';
import path from 'path';
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
        console.log(`Cleanup: ${sessionResult.deleted} sessions, ${tokenResult} tokens removed`);
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
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'server_error',
    message: 'An unexpected error occurred.',
  });
});

// Graceful shutdown
let server;
if (import.meta.url === `file://${process.argv[1]}`) {
  startCleanupJobs();
  server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    
    // Start automatic session cleanup (uses sessionService)
    startSessionCleanup();
    
    // Schedule periodic cleanup of expired password reset tokens
    const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    setInterval(async () => {
      try {
        const tokensDeleted = await passwordResetService.cleanupExpiredTokens();
        if (config.nodeEnv === 'development') {
          console.log(`Token cleanup: ${tokensDeleted} expired tokens removed`);
        }
      } catch (error) {
        console.error('Token cleanup error:', error);
      }
    }, TOKEN_CLEANUP_INTERVAL);
  });
}

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  await pool.end();
  console.log('Database pool closed');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
