import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './auth/routes.js';
import passwordResetRoutes from './routes/passwordReset.js';
import protectedRoutes from './routes/protected.js';
import { cors } from './middleware/cors.js';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS middleware - must be before other middleware
app.use(cors());

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window for auth endpoints
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

// Auth routes (rate limited)
app.use('/auth', authLimiter, authRoutes);

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
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'server_error',
    message: 'An unexpected error occurred.',
  });
});

// Graceful shutdown
let server;
if (import.meta.url === `file://${process.argv[1]}`) {
  server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
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
