-- Enhanced Sessions Migration
-- Adds metadata columns for robust session management

-- Add new columns to sessions table
ALTER TABLE sessions 
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT FALSE;

-- Index for cleanup and listing queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_revoked ON sessions(is_revoked);

-- Function to auto-update last_activity_at
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating last_activity
DROP TRIGGER IF EXISTS update_sessions_last_activity ON sessions;
CREATE TRIGGER update_sessions_last_activity
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_last_activity();
