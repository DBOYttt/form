# Setup Guide

Complete setup instructions for the authentication service.

## Prerequisites

- **Node.js**: Version 18 or higher
- **PostgreSQL**: Version 12 or higher
- **SMTP Server**: For email features (optional for development)

---

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository (if applicable)
git clone <repository-url>
cd auth-service

# Run setup script
./setup.sh
```

Or manually:

```bash
npm install
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your settings:

```env
# Database (required)
DATABASE_URL=postgresql://username:password@localhost:5432/auth_db

# Session Secret (required - generate a secure random string)
SESSION_SECRET=your-super-secret-key-change-in-production-min-32-chars

# SMTP (optional for development)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
```

### 3. Setup Database

```bash
# Create database
createdb auth_db

# Run migrations
npm run migrate
```

### 4. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will be available at `http://localhost:3000`

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/auth_db` |
| `SESSION_SECRET` | Secret for session encryption (min 32 chars) | `your-secure-random-string-here` |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `auth_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |

> **Note:** If `DATABASE_URL` is set, it takes precedence over individual DB_* variables.

### Session Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_EXPIRY_MS` | Session lifetime (ms) | `86400000` (24h) |
| `SESSION_TOKEN_TYPE` | Token type: `opaque` or `jwt` | `opaque` |
| `MAX_CONCURRENT_SESSIONS` | Max sessions per user (0=unlimited) | `0` |
| `SESSION_CLEANUP_INTERVAL_MS` | Cleanup interval (ms) | `3600000` (1h) |
| `SESSION_REFRESH_THRESHOLD_MS` | Auto-refresh threshold (ms) | `3600000` (1h) |

### JWT Configuration

Required only if `SESSION_TOKEN_TYPE=jwt`:

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret | Uses `SESSION_SECRET` |
| `ACCESS_TOKEN_EXPIRY_MS` | Access token lifetime | `900000` (15min) |
| `REFRESH_TOKEN_EXPIRY_MS` | Refresh token lifetime | `604800000` (7d) |

### Email Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `SMTP_FROM` | From email address | `noreply@example.com` |
| `SMTP_SECURE` | Use TLS | `false` |

### Application Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `APP_URL` | Public URL for email links | `http://localhost:3000` |
| `APP_NAME` | Application name | `Authentication System` |

### Security Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

### Token Expiry Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `PASSWORD_RESET_EXPIRY` | Reset token expiry (seconds) | `3600` (1h) |
| `EMAIL_VERIFICATION_EXPIRY` | Verification expiry (seconds) | `86400` (24h) |

---

## Database Setup

### Using Docker

```bash
# Start PostgreSQL container
docker run -d \
  --name auth-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=auth_db \
  -p 5432:5432 \
  postgres:15

# Run migrations
npm run migrate
```

### Using Local PostgreSQL

```bash
# Create database
createdb auth_db

# Or using psql
psql -c "CREATE DATABASE auth_db;"

# Run migrations
npm run migrate
```

### Migration Commands

```bash
# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate:status
```

### Database Schema

The service creates the following tables:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity_at TIMESTAMP,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## SMTP Setup

### Development (Without SMTP)

For development, emails are logged to console instead of being sent.

### Mailtrap (Testing)

1. Create account at [mailtrap.io](https://mailtrap.io)
2. Get SMTP credentials from inbox settings
3. Configure `.env`:

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
```

### Gmail

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false
```

> **Note:** Use App Passwords, not your Gmail password.

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Amazon SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-user
SMTP_PASS=your-ses-smtp-pass
```

---

## Running the Service

### Development

```bash
# With auto-reload
npm run dev

# Or using the start script
./start.sh
```

### Production

```bash
# Using start script
./start-prod.sh

# Or directly
NODE_ENV=production npm start
```

### With PM2 (Recommended for Production)

```bash
# Install PM2
npm install -g pm2

# Start service
pm2 start src/index.js --name auth-service

# View logs
pm2 logs auth-service

# Restart
pm2 restart auth-service

# Stop
pm2 stop auth-service
```

### With Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build image
docker build -t auth-service .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/auth_db \
  -e SESSION_SECRET=your-secret \
  auth-service
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
node --test src/utils/validation.test.js
```

### Run with Coverage (if available)

```bash
npm test -- --experimental-test-coverage
```

---

## Linting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

---

## Troubleshooting

### Database Connection Issues

```
Error: ECONNREFUSED 127.0.0.1:5432
```

**Solution:** Ensure PostgreSQL is running:
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (varies by OS)
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql
```

### Migration Errors

```
Error: relation "users" already exists
```

**Solution:** Check migration status and reset if needed:
```bash
npm run migrate:status
npm run migrate:down
npm run migrate
```

### Email Not Sending

1. Check SMTP configuration
2. Verify credentials are correct
3. Check firewall allows outbound SMTP connections
4. For Gmail, enable "Less secure apps" or use App Password

### Session Issues

```
Error: Session is invalid or has expired
```

**Solutions:**
1. Check `SESSION_EXPIRY_MS` setting
2. Verify system clocks are synchronized
3. Check if session cleanup is running too aggressively

---

## Project Structure

```
.
├── docs/                    # Documentation
│   ├── API.md              # API reference
│   ├── SECURITY.md         # Security guide
│   └── SETUP.md            # This file
├── migrations/             # Database migrations
├── src/
│   ├── auth/               # Authentication routes
│   │   ├── routes.js
│   │   └── registration.js
│   ├── middleware/         # Express middleware
│   │   ├── auth.js
│   │   ├── cors.js
│   │   └── rateLimit.js
│   ├── routes/             # Additional routes
│   │   ├── passwordReset.js
│   │   └── protected.js
│   ├── services/           # Business logic
│   │   ├── authService.js
│   │   ├── sessionService.js
│   │   └── passwordResetService.js
│   ├── utils/              # Utilities
│   │   ├── token.js
│   │   ├── validation.js
│   │   └── rateLimiter.js
│   ├── email/              # Email service
│   │   └── mailer.js
│   ├── config.js           # Configuration
│   ├── db.js               # Database connection
│   └── index.js            # Entry point
├── .env.example            # Example environment file
├── package.json
├── setup.sh                # Setup script
├── start.sh                # Development start script
└── start-prod.sh           # Production start script
```

---

## Next Steps

1. **Review Security Guide**: See [SECURITY.md](./SECURITY.md)
2. **Explore API**: See [API.md](./API.md)
3. **Run Tests**: `npm test`
4. **Deploy**: Follow production checklist in Security Guide
