-- Migration: 003_add_user_roles (down)
-- Removes role-based access control from users table

-- Remove check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Remove index
DROP INDEX IF EXISTS idx_users_role;

-- Remove role column
ALTER TABLE users DROP COLUMN IF EXISTS role;
