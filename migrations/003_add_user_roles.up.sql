-- Migration: 003_add_user_roles
-- Adds role-based access control to users table

-- Add role column to users table with default value 'user'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Add index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add check constraint for valid roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('user', 'moderator', 'admin'));
