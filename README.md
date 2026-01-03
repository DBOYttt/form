# User Registration with Email Verification

A Node.js authentication service implementing secure user registration with email verification.

## Features

- User registration with email, password, and confirm password
- Email format validation
- Password strength requirements (8+ chars, uppercase, lowercase, number)
- Password hashing with bcrypt (12 rounds)
- Email uniqueness validation
- Cryptographically secure verification tokens
- Email verification flow with expiring tokens
- Resend verification email functionality

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

**Error Response (400):**
```json
{
  "success": false,
  "errors": ["Password must be at least 8 characters"]
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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment mode |
| DB_HOST | localhost | PostgreSQL host |
| DB_PORT | 5432 | PostgreSQL port |
| DB_NAME | auth_db | Database name |
| DB_USER | postgres | Database user |
| DB_PASSWORD | postgres | Database password |
| SMTP_HOST | localhost | SMTP server host |
| SMTP_PORT | 587 | SMTP server port |
| SMTP_SECURE | false | Use TLS |
| SMTP_USER | - | SMTP username |
| SMTP_PASSWORD | - | SMTP password |
| EMAIL_FROM | noreply@example.com | Sender email |
| BASE_URL | http://localhost:3000 | Application base URL |
| BCRYPT_ROUNDS | 12 | Password hashing cost |
| VERIFICATION_TOKEN_EXPIRY_HOURS | 24 | Token expiry time |

## Setup

1. Run database migrations:
   ```bash
   psql -d auth_db -f migrations/001_create_auth_tables.up.sql
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (see above)

4. Start the server:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

## Testing

```bash
npm test
```

## Security Considerations

- Passwords hashed with bcrypt (configurable rounds)
- Verification tokens are 32 bytes of cryptographic randomness
- Tokens expire after 24 hours (configurable)
- Email normalization (lowercase, trimmed)
- Constant-time comparison not exposed via timing attacks
- Generic responses to prevent email enumeration on resend
