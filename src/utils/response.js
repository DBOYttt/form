/**
 * Standardized API Response Utilities
 * Ensures consistent response format across all endpoints
 */

/**
 * Send a success response
 * @param {object} res - Express response object
 * @param {object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    ...data,
  });
}

/**
 * Send an error response
 * @param {object} res - Express response object
 * @param {string} error - Error code (e.g., 'validation_error', 'unauthorized')
 * @param {string} message - Human-readable error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {object} details - Additional error details (optional)
 */
export function sendError(res, error, message, statusCode = 400, details = null) {
  const response = {
    success: false,
    error,
    message,
  };
  
  if (details) {
    response.details = details;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Common error responses
 */
export const errors = {
  unauthorized: (res, message = 'Authentication required.') => 
    sendError(res, 'unauthorized', message, 401),
  
  forbidden: (res, message = 'You do not have permission to access this resource.') => 
    sendError(res, 'forbidden', message, 403),
  
  notFound: (res, message = 'Resource not found.') => 
    sendError(res, 'not_found', message, 404),
  
  validation: (res, message, details = null) => 
    sendError(res, 'validation_error', message, 400, details),
  
  conflict: (res, message) => 
    sendError(res, 'conflict', message, 409),
  
  rateLimited: (res, message = 'Too many requests. Please try again later.', retryAfter = null) => {
    const response = {
      success: false,
      error: 'rate_limited',
      message,
    };
    if (retryAfter) {
      response.retryAfter = retryAfter;
    }
    return res.status(429).json(response);
  },
  
  serverError: (res, message = 'An unexpected error occurred.') => 
    sendError(res, 'server_error', message, 500),
};
