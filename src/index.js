import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Auth routes (registration, email verification, login, logout)
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
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'server_error',
    message: 'An unexpected error occurred.',
  });
});

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  pool.end(() => {
    console.log('Database pool closed.');
    process.exit(0);
  });
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

// Start server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
