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
- SMTP server (for email features)

### Installation

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
| `npm run setup` | Install dependencies and run migrations |
| `npm run migrate` | Run pending database migrations |
| `npm run migrate:down` | Rollback last migration |
| `npm run migrate:status` | Show migration status |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session encryption (min 32 chars) |

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
│   └── ...
├── scripts/            # Utility scripts
│   └── migrate.js      # Migration runner
└── src/                # Application source
    └── index.js        # Entry point
```

## Database Schema

The authentication system uses the following tables:

- **users** - User accounts with email and password hash
- **sessions** - Active user sessions
- **password_reset_tokens** - Password reset tokens
- **email_verification_tokens** - Email verification tokens

## Security Considerations

- Passwords hashed with bcrypt (configurable rounds)
- Verification and reset tokens are 32 bytes of cryptographic randomness
- Reset tokens are hashed with SHA-256 before storage
- Email verification tokens expire after 24 hours (configurable)
- Password reset tokens expire after 1 hour
- Reset tokens are single-use
- All sessions invalidated on password reset
- Email normalization (lowercase, trimmed)
- Generic responses to prevent email enumeration
- Use HTTPS in production
- Rate limiting to prevent brute force attacks

## License

MIT
