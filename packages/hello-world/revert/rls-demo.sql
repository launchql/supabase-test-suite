-- Revert: rls-demo from pg

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON rls_test.pets;

-- Drop trigger function
DROP FUNCTION IF EXISTS rls_test.update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_users_user_id;

-- Revoke permissions from service role
REVOKE ALL ON rls_test.pets FROM service_role;
REVOKE USAGE ON SCHEMA rls_test FROM service_role;

-- Revoke permissions from authenticated users
REVOKE ALL ON rls_test.pets FROM authenticated;
REVOKE USAGE ON SCHEMA rls_test FROM authenticated;

-- Revoke permissions from anon users
REVOKE ALL ON rls_test.pets FROM anon;
REVOKE USAGE ON SCHEMA rls_test FROM anon;

-- Drop policies
DROP POLICY IF EXISTS "Users can delete own data" ON rls_test.pets;
DROP POLICY IF EXISTS "Users can insert own data" ON rls_test.pets;
DROP POLICY IF EXISTS "Users can update own data" ON rls_test.pets;
DROP POLICY IF EXISTS "Users can view own data" ON rls_test.pets;

-- Drop tables
DROP TABLE IF EXISTS rls_test.pets;

-- Drop schemas
DROP SCHEMA IF EXISTS rls_test;
