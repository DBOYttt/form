import * as authService from '../services/authService.js';
import { config } from '../config.js';

/**
 * Middleware to authenticate requests using session token
 * Validates the session and attaches user info to the request
 * Handles automatic token refresh when session is nearing expiration
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required. Please provide a valid session token.',
    });
  }

  const token = authHeader.substring(7);

  try {
    const session = await authService.validateSession(token);

    if (!session.valid) {
      return res.status(401).json({
        error: 'invalid_session',
        message: 'Session is invalid or has expired. Please log in again.',
      });
    }

    req.user = session.user;
    req.sessionToken = token;
    req.sessionId = session.sessionId;
    req.sessionMetadata = session.metadata;

    // Check if token needs refresh (within 1 hour of expiration)
    const expiresAt = new Date(session.expiresAt);
    const refreshThreshold = 60 * 60 * 1000; // 1 hour
    if (expiresAt.getTime() - Date.now() < refreshThreshold) {
      try {
        const newSession = await authService.refreshSession(token);
        if (newSession.success) {
          res.set('X-New-Token', newSession.token);
          res.set('X-Token-Expires-At', newSession.expiresAt.toISOString());
        }
      } catch (refreshError) {
        // Log but don't fail the request if refresh fails
        console.error('Token refresh error:', refreshError);
      }
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred during authentication.',
    });
  }
}

/**
 * Optional authentication - attaches user if token is valid, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const session = await authService.validateSession(token);
    if (session.valid) {
      req.user = session.user;
      req.sessionToken = token;
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
}

/**
 * Role-based access control middleware factory
 * @param {string[]} allowedRoles - Array of roles that can access the route
 * @returns {Function} Express middleware function
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const userRole = req.user.role || 'user';
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to access this resource.',
      });
    }

    next();
  };
}

/**
 * Check if user owns the resource or is admin
 * @param {Function} getResourceOwnerId - Function that extracts owner ID from request
 * @returns {Function} Express middleware function
 */
export function requireOwnershipOrRole(getResourceOwnerId, ...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const userRole = req.user.role || 'user';
    
    // Admin or allowed roles can access any resource
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    try {
      const ownerId = await getResourceOwnerId(req);
      
      if (ownerId && ownerId === req.user.id) {
        return next();
      }

      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to access this resource.',
      });
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        error: 'server_error',
        message: 'An error occurred while checking permissions.',
      });
    }
  };
}

/**
 * Route protection wrapper - combines authentication with optional role check
 * @param {Object} options - Protection options
 * @param {string[]} options.roles - Optional array of allowed roles
 * @returns {Function[]} Array of middleware functions
 */
export function protect(options = {}) {
  const middleware = [authenticate];
  
  if (options.roles && options.roles.length > 0) {
    middleware.push(requireRole(...options.roles));
  }
  
  return middleware;
}
