-- Rollback Enhanced Sessions Migration

DROP TRIGGER IF EXISTS update_sessions_last_activity ON sessions;
DROP FUNCTION IF EXISTS update_session_last_activity();

DROP INDEX IF EXISTS idx_sessions_last_activity;
DROP INDEX IF EXISTS idx_sessions_is_revoked;

ALTER TABLE sessions 
    DROP COLUMN IF EXISTS ip_address,
    DROP COLUMN IF EXISTS user_agent,
    DROP COLUMN IF EXISTS last_activity_at,
    DROP COLUMN IF EXISTS is_revoked;
