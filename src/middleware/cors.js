/**
 * CORS Configuration Middleware
 * Configures Cross-Origin Resource Sharing for API endpoints
 */

import { config } from '../config.js';

// Default allowed origins (can be overridden via environment)
const getAllowedOrigins = () => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  
  // Default origins based on environment
  if (config.nodeEnv === 'production') {
    return [config.baseUrl];
  }
  
  // Development: allow localhost variations
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite default
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
  ];
};

/**
 * CORS middleware with configurable options
 * @param {Object} options - CORS configuration options
 * @param {string[]} options.allowedOrigins - Array of allowed origins
 * @param {string[]} options.allowedMethods - Array of allowed HTTP methods
 * @param {string[]} options.allowedHeaders - Array of allowed headers
 * @param {string[]} options.exposedHeaders - Array of headers to expose to client
 * @param {boolean} options.credentials - Whether to allow credentials
 * @param {number} options.maxAge - Preflight cache duration in seconds
 */
export function cors(options = {}) {
  const {
    allowedOrigins = getAllowedOrigins(),
    allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders = [
      'X-New-Token',
      'X-Token-Expires-At',
    ],
    credentials = true,
    maxAge = 86400, // 24 hours
  } = options;

  return (req, res, next) => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin) {
      const isAllowed = allowedOrigins.includes('*') || 
                        allowedOrigins.includes(origin) ||
                        allowedOrigins.some(allowed => {
                          if (allowed.includes('*')) {
                            const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
                            return pattern.test(origin);
                          }
                          return false;
                        });

      if (isAllowed) {
        res.set('Access-Control-Allow-Origin', origin);
      }
    }

    // Set CORS headers
    if (credentials) {
      res.set('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', allowedMethods.join(', '));
      res.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      res.set('Access-Control-Max-Age', String(maxAge));
      
      if (exposedHeaders.length > 0) {
        res.set('Access-Control-Expose-Headers', exposedHeaders.join(', '));
      }
      
      return res.status(204).end();
    }

    // Expose headers for non-preflight requests
    if (exposedHeaders.length > 0) {
      res.set('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    }

    next();
  };
}

/**
 * Create a restrictive CORS policy for sensitive endpoints
 */
export function restrictiveCors() {
  return cors({
    allowedOrigins: config.nodeEnv === 'production' 
      ? [config.baseUrl] 
      : getAllowedOrigins(),
    allowedMethods: ['GET', 'POST'],
    credentials: true,
  });
}

export default cors;
