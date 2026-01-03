# Authentication API Reference

This document provides complete API documentation for the authentication service.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Endpoints](#endpoints)
   - [Registration](#registration)
   - [Email Verification](#email-verification)
   - [Login](#login)
   - [Logout](#logout)
   - [Session Management](#session-management)
   - [Password Reset](#password-reset)
5. [Rate Limiting](#rate-limiting)
6. [Security Considerations](#security-considerations)

---

## Overview

Base URL: `http://localhost:3000` (configurable via `APP_URL`)

Content Type: `application/json`

All request and response bodies use JSON format.

---

## Authentication

Protected endpoints require a Bearer token in the Authorization header:

```http
Authorization: Bearer <session_token>
```

### Token Types

The service supports two token types (configurable via `SESSION_TOKEN_TYPE`):

| Type | Description |
|------|-------------|
| `opaque` (default) | Secure random tokens stored server-side |
| `jwt` | JSON Web Tokens with embedded claims |

---

## Error Handling

### Error Response Format

```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `validation_error` | 400 | Invalid input data |
| `unauthorized` | 401 | Authentication required |
| `invalid_credentials` | 401 | Wrong email or password |
| `invalid_session` | 401 | Session expired or invalid |
| `email_not_verified` | 401 | Email verification required |
| `forbidden` | 403 | Insufficient permissions |
| `session_not_found` | 404 | Session does not exist |
| `rate_limited` | 429 | Too many requests |
| `server_error` | 500 | Internal server error |

---

## Endpoints

### Registration

#### POST /auth/register

Create a new user account.

**Rate Limit:** Strict (5 requests per 15 minutes)

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123"
}
```

**Validation Rules:**
- `email`: Valid email format, max 255 characters
- `password`: 8-128 characters, must include:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- `confirmPassword`: Must match password

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}
```

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "errors": [
    "Password must be at least 8 characters",
    "Password must contain at least one uppercase letter"
  ]
}
```

**Example (cURL):**

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "confirmPassword": "SecurePass123"
  }'
```

---

### Email Verification

#### GET /auth/verify-email

Verify user's email address using the token sent via email.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Verification token from email |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Error Responses:**

| Status | Error |
|--------|-------|
| 400 | Invalid or expired verification token |
| 400 | Email is already verified |

**Example:**

```bash
curl "http://localhost:3000/auth/verify-email?token=abc123..."
```

---

#### POST /auth/resend-verification

Resend verification email to user.

**Rate Limit:** Strict (5 requests per 15 minutes)

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "If an account exists, a verification email has been sent"
}
```

> **Note:** Returns success even for non-existent emails to prevent email enumeration.

---

### Login

#### POST /auth/login

Authenticate user and create session.

**Rate Limit:** Auth (10 requests per 15 minutes per email/IP)

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Success Response (200 OK):**

```json
{
  "message": "Login successful.",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  },
  "token": "a1b2c3d4e5f6...",
  "expiresAt": "2026-01-04T14:00:00.000Z"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `validation_error` | Email/password missing or invalid format |
| 401 | `invalid_credentials` | Wrong email or password |
| 401 | `email_not_verified` | Email not yet verified |
| 429 | `rate_limited` | Account temporarily locked |

**Rate Limit Response (429):**

```json
{
  "error": "rate_limited",
  "message": "Account temporarily locked. Try again in 30 minute(s)."
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123"}'
```

---

### Logout

#### POST /auth/logout

🔒 **Requires Authentication**

Invalidate current session.

**Headers:**

```http
Authorization: Bearer <token>
```

**Success Response (200 OK):**

```json
{
  "message": "Logged out successfully."
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer a1b2c3d4e5f6..."
```

---

#### POST /auth/logout-all

🔒 **Requires Authentication**

Invalidate all sessions for the current user.

**Success Response (200 OK):**

```json
{
  "message": "Successfully logged out of 3 session(s)."
}
```

---

### Session Management

#### GET /auth/session

🔒 **Requires Authentication**

Get current session information.

**Success Response (200 OK):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "user"
  },
  "expiresAt": "2026-01-04T14:00:00.000Z",
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "lastActivity": "2026-01-03T14:30:00.000Z",
    "createdAt": "2026-01-03T10:00:00.000Z"
  }
}
```

---

#### GET /auth/sessions

🔒 **Requires Authentication**

List all active sessions for the current user.

**Success Response (200 OK):**

```json
{
  "sessions": [
    {
      "id": "session-uuid-1",
      "ip": "192.168.1.1",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "lastActivity": "2026-01-03T14:30:00.000Z",
      "createdAt": "2026-01-03T10:00:00.000Z",
      "expiresAt": "2026-01-04T10:00:00.000Z"
    },
    {
      "id": "session-uuid-2",
      "ip": "10.0.0.5",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)...",
      "lastActivity": "2026-01-03T12:00:00.000Z",
      "createdAt": "2026-01-02T08:00:00.000Z",
      "expiresAt": "2026-01-03T08:00:00.000Z"
    }
  ],
  "count": 2
}
```

---

#### DELETE /auth/sessions/:sessionId

🔒 **Requires Authentication**

Revoke a specific session.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | ID of the session to revoke |

**Success Response (200 OK):**

```json
{
  "message": "Session revoked successfully."
}
```

**Error Response (404 Not Found):**

```json
{
  "error": "session_not_found",
  "message": "Session not found or already revoked."
}
```

---

#### POST /auth/session/refresh

🔒 **Requires Authentication**

Extend the current session's expiration time.

**Success Response (200 OK):**

```json
{
  "message": "Session refreshed successfully.",
  "expiresAt": "2026-01-04T14:30:00.000Z"
}
```

---

#### POST /auth/session/rotate

🔒 **Requires Authentication**

Generate a new session token while maintaining the session.

**Success Response (200 OK):**

```json
{
  "message": "Session token rotated successfully.",
  "token": "new-token-xyz789...",
  "expiresAt": "2026-01-04T14:30:00.000Z"
}
```

> **Use Case:** Recommended after sensitive operations or when you suspect token compromise.

---

### Password Reset

#### POST /api/auth/forgot-password

Request a password reset email.

**Rate Limit:** Strict (5 requests per 15 minutes)

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

> **Note:** Always returns success to prevent email enumeration attacks.

---

#### GET /api/auth/reset-password/validate

Validate a password reset token before showing the reset form.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Reset token from email |

**Success Response (200 OK):**

```json
{
  "valid": true,
  "email": "user@example.com"
}
```

**Error Response (400 Bad Request):**

```json
{
  "valid": false,
  "error": "Invalid or expired reset token"
}
```

---

#### POST /api/auth/reset-password

Reset password using a valid token.

**Rate Limit:** Strict (5 requests per 15 minutes)

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecureP@ss123",
  "confirmPassword": "NewSecureP@ss123"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

**Error Responses:**

| Error | Description |
|-------|-------------|
| `validation_error` | Password doesn't meet requirements or doesn't match |
| `invalid_token` | Token is invalid, expired, or already used |

---

## Rate Limiting

### Limits

| Endpoint Type | Max Requests | Window | Lockout |
|--------------|--------------|--------|---------|
| Auth (login) | 5 attempts | 15 min | 30 min |
| Strict (register, reset) | 5 requests | 15 min | - |
| General | 100 requests | 15 min | - |

### Response Headers

Rate-limited responses include:

```http
Retry-After: 1800
X-RateLimit-Remaining: 0
```

### Rate Limit Response (429)

```json
{
  "error": "rate_limited",
  "message": "Account temporarily locked. Try again in 30 minute(s)."
}
```

---

## Security Considerations

### Password Requirements

- Minimum 8 characters, maximum 128
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

### Token Security

- Session tokens: 64 bytes of cryptographic randomness
- Tokens are hashed with SHA-256 before storage
- Tokens expire after 24 hours (configurable)
- Password reset tokens expire after 1 hour
- Verification tokens expire after 24 hours

### Session Security

- Concurrent session limits (configurable)
- Session metadata tracking (IP, user agent)
- Automatic cleanup of expired sessions
- Token rotation available for sensitive operations
- All sessions invalidated on password reset

### Best Practices

1. **Use HTTPS in production** - All tokens should be transmitted over TLS
2. **Store tokens securely** - Use secure storage on clients (httpOnly cookies or secure storage)
3. **Rotate tokens** - After sensitive operations like password changes
4. **Monitor sessions** - Use `/auth/sessions` to review active sessions
5. **Enable concurrent session limits** - Prevent unlimited session accumulation

### Response Security

- Email enumeration protection on registration/reset
- Timing-safe token comparisons
- Generic error messages for authentication failures
- Rate limiting on all auth endpoints

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Login
const response = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123'
  })
});

const { token, user, expiresAt } = await response.json();

// Authenticated request
const sessionResponse = await fetch('http://localhost:3000/auth/session', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Logout
await fetch('http://localhost:3000/auth/logout', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Python

```python
import requests

# Login
response = requests.post('http://localhost:3000/auth/login', json={
    'email': 'user@example.com',
    'password': 'SecurePass123'
})
data = response.json()
token = data['token']

# Authenticated request
session_response = requests.get(
    'http://localhost:3000/auth/session',
    headers={'Authorization': f'Bearer {token}'}
)

# Logout
requests.post(
    'http://localhost:3000/auth/logout',
    headers={'Authorization': f'Bearer {token}'}
)
```

### cURL

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123","confirmPassword":"SecurePass123"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123"}' | jq -r '.token')

# Get session info
curl http://localhost:3000/auth/session \
  -H "Authorization: Bearer $TOKEN"

# List all sessions
curl http://localhost:3000/auth/sessions \
  -H "Authorization: Bearer $TOKEN"

# Logout
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```
