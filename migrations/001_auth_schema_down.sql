-- Rollback: Authentication Database Schema
-- Migration: 001_auth_schema_down.sql

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
