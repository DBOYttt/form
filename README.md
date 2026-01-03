# Authentication Service

A Node.js authentication service implementing secure user registration with email verification and password reset.

## Features

### User Registration
- User registration with email, password, and confirm password
- Email format validation
- Password strength requirements (8+ chars, uppercase, lowercase, number)
- Password hashing with bcrypt (12 rounds)
- Email uniqueness validation
- Email verification flow with expiring tokens
- Password reset via email
- Session-based authentication
- Resend verification email functionality

### Session Management
- Secure session tokens (opaque or JWT)
- Session storage in database with user association
- Configurable session expiration
- Session refresh/renewal mechanism
- Concurrent session limits (configurable)
- List all active sessions
- Revoke specific sessions
- Automatic cleanup of expired sessions
- Session metadata tracking (IP, user agent, last activity)

### Password Reset
- Forgot password form with email input
- Secure token generation with SHA-256 hashing
- Configurable token expiration (default 1 hour)
- Password reset form with confirmation
- Token validation (exists, not expired, not used)
- Session invalidation on password reset
- Email enumeration protection

## Quick Start

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- SMTP server (for email features - not needed in dev mode)

### Development Mode (Quickstart)

Get started immediately with zero configuration:

```bash
# Clone and install
git clone <repository>
cd auth-service
npm install

# Start in dev mode (uses .env.development automatically)
npm run dev
# Or use the dev script with more options
./dev.sh
```

Dev mode automatically:
- Bypasses email verification (users auto-verified on registration)
- Logs emails to console instead of sending
- Allows weak passwords (min 4 chars)
- Disables rate limiting
- Enables verbose error messages with stack traces
- Allows all CORS origins

#### Dev Script Options

```bash
./dev.sh                  # Start dev server
./dev.sh --reset-db       # Wipe and recreate database
./dev.sh --seed           # Seed with test users
./dev.sh --port 8080      # Use custom port
npm run dev:reset         # Reset DB and seed test users
```

#### Test Users (after seeding)

| Email | Password | Status |
|-------|----------|--------|
| test@example.com | password123 | Verified |
| unverified@example.com | password123 | Unverified |

### Installation (Production)

1. **Clone and setup:**
   ```bash
   ./setup.sh
   ```

2. **Configure environment:**
   
   Edit `.env` with your settings:
   ```bash
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/auth_db
   
   # Session (generate a secure random string)
   SESSION_SECRET=your-secure-secret-at-least-32-characters
   
   # SMTP for emails
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your-username
   SMTP_PASS=your-password
   ```

3. **Create database and run migrations:**
   ```bash
   createdb auth_db
   npm run migrate
   ```

4. **Start the server:**
   ```bash
   ./start.sh        # Development
   ./start-prod.sh   # Production
   ```

## API Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### GET /auth/verify-email?token={token}
Verify email address with the token sent via email.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### POST /auth/resend-verification
Resend verification email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful.",
  "user": { "id": "uuid", "email": "user@example.com" },
  "token": "session-token",
  "expiresAt": "2026-01-04T13:38:36.595Z"
}
```

### POST /auth/logout
Logout current session. Requires authentication.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "message": "Logged out successfully."
}
```

### POST /auth/logout-all
Logout all sessions for the current user.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "message": "Successfully logged out of 3 session(s)."
}
```

### GET /auth/session
Get current session information.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "expiresAt": "2026-01-04T13:38:36.595Z",
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "lastActivity": "2026-01-03T14:00:00.000Z",
    "createdAt": "2026-01-03T13:38:36.595Z"
  }
}
```

### GET /auth/sessions
List all active sessions for the current user.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "ip": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "lastActivity": "2026-01-03T14:00:00.000Z",
      "createdAt": "2026-01-03T13:38:36.595Z",
      "expiresAt": "2026-01-04T13:38:36.595Z"
    }
  ],
  "count": 1
}
```

### DELETE /auth/sessions/:sessionId
Revoke a specific session.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "message": "Session revoked successfully."
}
```

### POST /auth/session/refresh
Refresh current session - extend expiration time.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "message": "Session refreshed successfully.",
  "expiresAt": "2026-01-04T14:00:00.000Z"
}
```

### POST /auth/session/rotate
Rotate session token - get a new token for the current session.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "message": "Session token rotated successfully.",
  "token": "new-session-token",
  "expiresAt": "2026-01-04T14:00:00.000Z"
}
```

### POST /api/auth/forgot-password
Request a password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### GET /api/auth/reset-password/validate
Validate a reset token before showing the reset form.

**Query Parameters:**
- `token`: The reset token from the email link

**Response (valid):**
```json
{
  "valid": true,
  "email": "user@example.com"
}
```

### POST /api/auth/reset-password
Reset password using a valid token.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecureP@ss123",
  "confirmPassword": "NewSecureP@ss123"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

## HTML Pages

- `/forgot-password` - Forgot password form
- `/reset-password?token=xxx` - Reset password form

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start development server with auto-reload |
| `npm run dev:full` | Start dev server using dev.sh script |
| `npm run dev:reset` | Reset database and seed test users |
| `npm run seed:dev` | Seed database with test users |
| `npm run setup` | Install dependencies and run migrations |
| `npm run migrate` | Run pending database migrations |
| `npm run migrate:down` | Rollback last migration |
| `npm run migrate:status` | Show migration status |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |

## Environment Variables

### Development Mode Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEV_MODE` | Enable all development features | `false` |
| `SKIP_EMAIL_VERIFICATION` | Auto-verify users on registration | `false` |
| `MOCK_EMAIL` | Log emails to console instead of sending | `false` |
| `DISABLE_RATE_LIMIT` | Disable rate limiting | `false` |
| `SAVE_DEV_EMAILS` | Save mock emails to files | `false` |
| `DEV_EMAILS_DIR` | Directory for saved mock emails | `./dev-emails` |
| `HOST` | Server host address | `0.0.0.0` |

> ⚠️ **Warning**: These settings should NEVER be enabled in production!

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session encryption (min 32 chars) |

### Session Management

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_EXPIRY_MS` | Session lifetime in milliseconds | `86400000` (24h) |
| `SESSION_TOKEN_TYPE` | Token type: `opaque` or `jwt` | `opaque` |
| `MAX_CONCURRENT_SESSIONS` | Max sessions per user (0=unlimited) | `0` |
| `SESSION_CLEANUP_INTERVAL_MS` | Cleanup interval in milliseconds | `3600000` (1h) |

### JWT Configuration (if using JWT tokens)

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT signing | `SESSION_SECRET` |
| `ACCESS_TOKEN_EXPIRY_MS` | Access token lifetime | `900000` (15min) |
| `REFRESH_TOKEN_EXPIRY_MS` | Refresh token lifetime | `604800000` (7d) |

### Email (SMTP)

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `SMTP_FROM` | From email address | `noreply@example.com` |
| `SMTP_SECURE` | Use TLS | `false` |

### Application

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `PORT` | Server port | `3000` |
| `APP_URL` | Public URL for email links | `http://localhost:3000` |
| `APP_NAME` | Application name | `Authentication System` |

### Token Expiry (seconds)

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_EXPIRY` | Session lifetime | `86400` (24h) |
| `PASSWORD_RESET_EXPIRY` | Password reset token lifetime | `3600` (1h) |
| `EMAIL_VERIFICATION_EXPIRY` | Email verification token lifetime | `86400` (24h) |

### Security

| Variable | Description | Default |
|----------|-------------|---------|
| `BCRYPT_ROUNDS` | Bcrypt hash rounds | `12` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

## Project Structure

```
.
├── config.js           # Configuration loader
├── package.json        # Dependencies and scripts
├── .env.example        # Example environment variables
├── start.sh            # Development start script (Unix)
├── start.bat           # Development start script (Windows)
├── start-prod.sh       # Production start script
├── setup.sh            # Initial setup script
├── migrations/         # Database migrations
│   ├── 001_auth_schema.sql
│   ├── 003_enhanced_sessions.up.sql  # Session metadata columns
│   └── ...
├── scripts/            # Utility scripts
│   └── migrate.js      # Migration runner
└── src/                # Application source
    ├── index.js        # Entry point
    ├── services/
    │   ├── authService.js      # Authentication logic
    │   └── sessionService.js   # Session management
    └── ...
```

## Database Schema

The authentication system uses the following tables:

- **users** - User accounts with email and password hash
- **sessions** - Active user sessions with metadata (IP, user agent, last activity)
- **password_reset_tokens** - Password reset tokens
- **email_verification_tokens** - Email verification tokens

## Security Considerations

- Passwords hashed with bcrypt (configurable rounds)
- Session tokens are 64 bytes of cryptographic randomness
- Tokens are hashed with SHA-256 before storage
- Email verification tokens expire after 24 hours (configurable)
- Password reset tokens expire after 1 hour
- Reset tokens are single-use
- All sessions invalidated on password reset
- Session metadata tracked for security auditing
- Concurrent session limits prevent session hijacking
- Automatic session cleanup removes expired sessions
- Token rotation available for sensitive operations
- Email normalization (lowercase, trimmed)
- Generic responses to prevent email enumeration
- Use HTTPS in production
- Rate limiting to prevent brute force attacks

## Documentation

For more detailed documentation, see:

- [API Reference](./docs/API.md) - Complete API endpoints documentation
- [Security Guide](./docs/SECURITY.md) - Security features and best practices
- [Setup Guide](./docs/SETUP.md) - Detailed installation and configuration

## Testing

```bash
# Run all tests
npm test

# Run specific test file
node --test src/utils/validation.test.js
```

Test coverage includes:
- Unit tests for validation, token, and rate limiter utilities
- Unit tests for auth middleware logic
- Integration tests for auth flows
- Tests for session management
- Tests for password reset flows

## License

MIT
