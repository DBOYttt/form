# Security Guide

This document covers the security features and best practices for the authentication service.

## Overview

The authentication service implements multiple security layers:

1. **Password Security** - Hashing and strength requirements
2. **Token Security** - Secure generation and storage
3. **Session Security** - Management and lifecycle
4. **Rate Limiting** - Brute force protection
5. **Data Protection** - Timing attacks and enumeration prevention

---

## Password Security

### Hashing

Passwords are hashed using bcrypt with configurable rounds:

```javascript
// Default: 12 rounds (configurable via BCRYPT_ROUNDS)
const hash = await bcrypt.hash(password, 12);
```

**Why bcrypt?**
- Adaptive hashing (rounds can be increased over time)
- Built-in salt generation
- Computationally expensive (resistant to brute force)

### Password Requirements

| Requirement | Value |
|-------------|-------|
| Minimum length | 8 characters |
| Maximum length | 128 characters |
| Uppercase letters | At least 1 (A-Z) |
| Lowercase letters | At least 1 (a-z) |
| Numbers | At least 1 (0-9) |

### Recommendations

1. **Increase bcrypt rounds** for production:
   ```env
   BCRYPT_ROUNDS=14
   ```
   Note: Higher rounds = slower hashing (12 ≈ 250ms, 14 ≈ 1s)

2. **Consider adding special character requirements** for high-security apps

3. **Implement password breach checking** (e.g., HaveIBeenPwned API)

---

## Token Security

### Session Tokens

Generated using cryptographically secure randomness:

```javascript
import { randomBytes } from 'crypto';

// 64 bytes = 128 hex characters
const token = randomBytes(64).toString('hex');
```

### Token Hashing

Tokens are hashed before database storage:

```javascript
import { createHash } from 'crypto';

const hashedToken = createHash('sha256')
  .update(token)
  .digest('hex');
```

**Why hash tokens?**
- Database leak protection
- Prevents timing attacks on database lookups
- Single-use verification tokens are safer

### Token Types

| Token Type | Length | Expiry | Storage |
|------------|--------|--------|---------|
| Session | 64 bytes | 24 hours | Hashed |
| Email verification | 64 bytes | 24 hours | Hashed |
| Password reset | 32 bytes | 1 hour | Hashed |

### Configuration

```env
SESSION_TOKEN_TYPE=opaque     # or 'jwt'
SESSION_EXPIRY_MS=86400000    # 24 hours
PASSWORD_RESET_EXPIRY=3600    # 1 hour
EMAIL_VERIFICATION_EXPIRY=86400  # 24 hours
```

---

## Session Security

### Session Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│   Active    │────▶│  Expired/   │
│             │     │   Session   │     │  Revoked    │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    ┌─────┴─────┐
                    ▼           ▼
              ┌──────────┐ ┌──────────┐
              │  Refresh │ │  Rotate  │
              └──────────┘ └──────────┘
```

### Session Metadata

Each session tracks:
- IP address
- User agent
- Created timestamp
- Last activity timestamp
- Expiration time

### Concurrent Session Limits

```env
MAX_CONCURRENT_SESSIONS=5  # 0 = unlimited
```

When the limit is exceeded, the oldest session is automatically revoked.

### Session Invalidation Triggers

| Event | Action |
|-------|--------|
| Logout | Single session revoked |
| Logout All | All sessions revoked |
| Password Reset | All sessions revoked |
| Password Change | All sessions revoked |
| Token Rotation | Old token invalidated |

### Session Cleanup

Automatic cleanup of expired sessions:

```env
SESSION_CLEANUP_INTERVAL_MS=3600000  # Every hour
```

---

## Rate Limiting

### Login Rate Limiting

Prevents brute force attacks:

| Setting | Value |
|---------|-------|
| Max attempts | 5 |
| Window | 15 minutes |
| Lockout duration | 30 minutes |

**Per email + IP combination** - Attacker can't lock out legitimate users easily.

### Implementation

```javascript
// In-memory tracking (use Redis in production)
const loginAttempts = new Map();

// Key format
const key = `${email}:${ip}`;
```

### Response After Lockout

```json
{
  "error": "rate_limited",
  "message": "Account temporarily locked. Try again in 30 minute(s)."
}
```

### Strict Rate Limiting

Applied to sensitive endpoints:
- POST /auth/register
- POST /auth/resend-verification
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

---

## Attack Prevention

### Email Enumeration

The service returns identical responses for existing and non-existing accounts:

```javascript
// Forgot password
return {
  success: true,
  message: 'If an account with that email exists, a password reset link has been sent.'
};

// Resend verification
return {
  success: true,
  message: 'If an account exists, a verification email has been sent'
};
```

### Timing Attacks

Token comparisons use constant-time comparison:

```javascript
import { timingSafeEqual } from 'crypto';

const tokenBuffer = Buffer.from(providedToken);
const storedBuffer = Buffer.from(storedToken);

if (tokenBuffer.length === storedBuffer.length && 
    timingSafeEqual(tokenBuffer, storedBuffer)) {
  // Valid token
}
```

### SQL Injection

All database queries use parameterized statements:

```javascript
// Safe
await query('SELECT * FROM users WHERE email = $1', [email]);

// Never do this
await query(`SELECT * FROM users WHERE email = '${email}'`);
```

### XSS Prevention

- JSON-only API responses
- No HTML rendering of user input
- Content-Type: application/json enforced

---

## Production Checklist

### Environment Configuration

```env
# Required for production
NODE_ENV=production
SESSION_SECRET=<generate-64-char-random-string>
JWT_SECRET=<generate-64-char-random-string>
BCRYPT_ROUNDS=12

# HTTPS enforcement
APP_URL=https://yourdomain.com
```

### HTTPS

Always use HTTPS in production:

```javascript
// Recommended: Set secure cookie flag
// Recommended: Enable HSTS headers
```

### Secrets Management

1. **Never commit secrets** to version control
2. Use environment variables or secret managers
3. Rotate secrets periodically
4. Generate secrets with cryptographic randomness:
   ```bash
   openssl rand -hex 32
   ```

### Monitoring

1. **Log authentication events**:
   - Login attempts (success/failure)
   - Password resets
   - Session creations/revocations

2. **Alert on anomalies**:
   - Unusual login patterns
   - Mass password reset requests
   - Rate limit triggers

### Database Security

1. **Encrypt at rest**
2. **Use SSL connections**
3. **Principle of least privilege** for DB user
4. **Regular backups** (encrypted)

---

## Security Headers

Recommended headers for API responses:

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

---

## Incident Response

### Token Compromise

If you suspect token compromise:

1. **Rotate the affected user's token**:
   ```bash
   curl -X POST /auth/session/rotate -H "Authorization: Bearer <token>"
   ```

2. **Or revoke all sessions**:
   ```bash
   curl -X POST /auth/logout-all -H "Authorization: Bearer <token>"
   ```

### Database Breach

If session tokens database is compromised:

1. Tokens are hashed - attacker cannot use them directly
2. Force password reset for all users
3. Rotate all secrets:
   - SESSION_SECRET
   - JWT_SECRET
4. Invalidate all sessions (change token hash algorithm or key)

### Password Breach

If password hashes are compromised:

1. bcrypt is resistant to brute force
2. Notify users to change passwords
3. Force password reset for affected accounts
4. Increase bcrypt rounds
5. Monitor for suspicious login activity

---

## Compliance Considerations

### GDPR

- User data deletion capability
- Session audit logs
- Data minimization (only store necessary data)

### PCI-DSS

- Strong password requirements ✓
- Session timeout ✓
- Account lockout ✓
- Secure credential storage ✓

### OWASP

This implementation follows OWASP guidelines for:
- [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
