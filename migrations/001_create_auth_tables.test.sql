-- Test Script for Authentication Schema
-- Run after applying 001_create_auth_tables.up.sql
-- Usage: psql -d test_database -f migrations/001_create_auth_tables.test.sql

\set ON_ERROR_STOP on

BEGIN;

-- ============================================
-- Test 1: Table creation
-- ============================================
DO $$
BEGIN
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users'), 'users table should exist';
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions'), 'sessions table should exist';
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_tokens'), 'password_reset_tokens table should exist';
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verification_tokens'), 'email_verification_tokens table should exist';
    RAISE NOTICE 'Test 1 PASSED: All tables exist';
END $$;

-- ============================================
-- Test 2: Insert a user
-- ============================================
INSERT INTO users (email, password_hash) VALUES ('test@example.com', '$2b$10$abcdefghijklmnopqrstuv');
DO $$
DECLARE
    user_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE email = 'test@example.com';
    ASSERT user_count = 1, 'Should have inserted 1 user';
    RAISE NOTICE 'Test 2 PASSED: User insertion works';
END $$;

-- ============================================
-- Test 3: Email uniqueness constraint
-- ============================================
DO $$
BEGIN
    BEGIN
        INSERT INTO users (email, password_hash) VALUES ('test@example.com', 'another_hash');
        RAISE EXCEPTION 'Should have failed on duplicate email';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Test 3 PASSED: Email uniqueness enforced';
    END;
END $$;

-- ============================================
-- Test 4: Default values
-- ============================================
DO $$
DECLARE
    u RECORD;
BEGIN
    SELECT * INTO u FROM users WHERE email = 'test@example.com';
    ASSERT u.email_verified = FALSE, 'email_verified should default to FALSE';
    ASSERT u.created_at IS NOT NULL, 'created_at should have default';
    ASSERT u.updated_at IS NOT NULL, 'updated_at should have default';
    RAISE NOTICE 'Test 4 PASSED: Default values work correctly';
END $$;

-- ============================================
-- Test 5: updated_at trigger
-- ============================================
DO $$
DECLARE
    original_updated_at TIMESTAMP WITH TIME ZONE;
    new_updated_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT updated_at INTO original_updated_at FROM users WHERE email = 'test@example.com';
    PERFORM pg_sleep(0.1);
    UPDATE users SET email_verified = TRUE WHERE email = 'test@example.com';
    SELECT updated_at INTO new_updated_at FROM users WHERE email = 'test@example.com';
    ASSERT new_updated_at > original_updated_at, 'updated_at should be updated by trigger';
    RAISE NOTICE 'Test 5 PASSED: updated_at trigger works';
END $$;

-- ============================================
-- Test 6: Foreign key relationships
-- ============================================
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM users WHERE email = 'test@example.com';
    
    -- Insert related records
    INSERT INTO sessions (user_id, token, expires_at) VALUES (test_user_id, 'session_token_123', NOW() + INTERVAL '1 day');
    INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (test_user_id, 'reset_token_123', NOW() + INTERVAL '1 hour');
    INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (test_user_id, 'verify_token_123', NOW() + INTERVAL '1 day');
    
    RAISE NOTICE 'Test 6 PASSED: Foreign key relationships work';
END $$;

-- ============================================
-- Test 7: CASCADE delete
-- ============================================
DO $$
DECLARE
    session_count INT;
    reset_count INT;
    verify_count INT;
BEGIN
    DELETE FROM users WHERE email = 'test@example.com';
    
    SELECT COUNT(*) INTO session_count FROM sessions WHERE token = 'session_token_123';
    SELECT COUNT(*) INTO reset_count FROM password_reset_tokens WHERE token = 'reset_token_123';
    SELECT COUNT(*) INTO verify_count FROM email_verification_tokens WHERE token = 'verify_token_123';
    
    ASSERT session_count = 0, 'Sessions should be deleted on user delete';
    ASSERT reset_count = 0, 'Password reset tokens should be deleted on user delete';
    ASSERT verify_count = 0, 'Email verification tokens should be deleted on user delete';
    
    RAISE NOTICE 'Test 7 PASSED: CASCADE delete works';
END $$;

-- ============================================
-- Test 8: Index existence
-- ============================================
DO $$
BEGIN
    ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email'), 'idx_users_email should exist';
    ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sessions_token'), 'idx_sessions_token should exist';
    ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_password_reset_tokens_token'), 'idx_password_reset_tokens_token should exist';
    ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_verification_tokens_token'), 'idx_email_verification_tokens_token should exist';
    ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_password_reset_tokens_valid'), 'idx_password_reset_tokens_valid should exist';
    RAISE NOTICE 'Test 8 PASSED: All indexes exist';
END $$;

ROLLBACK;

\echo '========================================'
\echo 'All tests passed!'
\echo '========================================'
