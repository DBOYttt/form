-- Authentication Database Schema
-- Migration: 001_create_auth_tables

-- Enable UUID extension if not already enabled (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index on email for login lookups
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- Sessions Table
-- ============================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index on token for session validation
CREATE INDEX idx_sessions_token ON sessions(token);
-- Index on user_id for user session lookups
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
-- Index on expires_at for cleanup queries
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- Password Reset Tokens Table
-- ============================================
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index on token for reset lookups
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
-- Index on user_id for user token lookups
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- ============================================
-- Email Verification Tokens Table
-- ============================================
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index on token for verification lookups
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
-- Index on user_id for user token lookups
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- ============================================
-- Trigger for updated_at on users table
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
