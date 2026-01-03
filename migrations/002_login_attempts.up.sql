-- Login Attempts Table for Rate Limiting
-- Migration: 002_login_attempts.up.sql

CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT FALSE
);

-- Index for rate limiting queries
CREATE INDEX idx_login_attempts_email_ip ON login_attempts(email, ip_address);
CREATE INDEX idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- Index for cleanup queries
CREATE INDEX idx_login_attempts_email_attempted_at ON login_attempts(email, attempted_at);
