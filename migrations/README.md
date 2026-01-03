# Authentication Database Schema

## Requirements

- **PostgreSQL 13+** (uses `gen_random_uuid()`)

## Tables

### users
Primary user account table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| email | VARCHAR(255) | Unique email address |
| password_hash | VARCHAR(255) | Hashed password (bcrypt/argon2) |
| email_verified | BOOLEAN | Whether email has been verified (default: false) |
| created_at | TIMESTAMPTZ | Account creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp (auto-updated via trigger) |

### sessions
Active user sessions for authentication.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| user_id | UUID | Foreign key to users.id (CASCADE delete) |
| token | VARCHAR(255) | Unique session token (min 32 bytes recommended) |
| expires_at | TIMESTAMPTZ | Session expiration time |
| created_at | TIMESTAMPTZ | Session creation timestamp |

### password_reset_tokens
Tokens for password reset functionality.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| user_id | UUID | Foreign key to users.id (CASCADE delete) |
| token | VARCHAR(255) | Unique reset token (min 32 bytes recommended) |
| expires_at | TIMESTAMPTZ | Token expiration time |
| used | BOOLEAN | Whether token has been used (default: false) |
| created_at | TIMESTAMPTZ | Token creation timestamp |

### email_verification_tokens
Tokens for email verification.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| user_id | UUID | Foreign key to users.id (CASCADE delete) |
| token | VARCHAR(255) | Unique verification token (min 32 bytes recommended) |
| expires_at | TIMESTAMPTZ | Token expiration time |
| created_at | TIMESTAMPTZ | Token creation timestamp |

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| idx_users_email | users | email | Fast login lookups |
| idx_sessions_token | sessions | token | Session validation |
| idx_sessions_user_id | sessions | user_id | User session lookups |
| idx_sessions_expires_at | sessions | expires_at | Cleanup queries |
| idx_password_reset_tokens_token | password_reset_tokens | token | Reset lookups |
| idx_password_reset_tokens_user_id | password_reset_tokens | user_id | User token lookups |
| idx_password_reset_tokens_valid | password_reset_tokens | user_id, expires_at | Valid token queries (partial) |
| idx_email_verification_tokens_token | email_verification_tokens | token | Verification lookups |
| idx_email_verification_tokens_user_id | email_verification_tokens | user_id | User token lookups |

## Token Recommendations

- **Session tokens:** 32+ bytes, cryptographically random
- **Password reset tokens:** 32+ bytes, single-use, expire in 1 hour
- **Email verification tokens:** 32+ bytes, expire in 24 hours

## Migrations

### Running migrations
```bash
psql -d your_database -f migrations/001_create_auth_tables.up.sql
```

### Rolling back
```bash
psql -d your_database -f migrations/001_create_auth_tables.down.sql
```

## Relationships

```
users (1) ──┬── (N) sessions
            ├── (N) password_reset_tokens
            └── (N) email_verification_tokens
```

All child tables have `ON DELETE CASCADE` - deleting a user removes all related records.
