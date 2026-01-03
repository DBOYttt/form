import * as authService from '../services/authService.js';

/**
 * Middleware to authenticate requests using session token
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
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred during authentication.',
    });
  }
}
