-- Revert: rls-demo from pg

-- Drop triggers
DROP TRIGGER IF EXISTS update_products_updated_at ON rls_test.products;
DROP TRIGGER IF EXISTS update_users_updated_at ON rls_test.user_profiles;

-- Drop trigger function
DROP FUNCTION IF EXISTS rls_test.update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_products_owner_id;

-- Drop policies
DROP POLICY IF EXISTS "Users can delete own products" ON rls_test.products;
DROP POLICY IF EXISTS "Users can update own products" ON rls_test.products;
DROP POLICY IF EXISTS "Users can insert own products" ON rls_test.products;
DROP POLICY IF EXISTS "Users can view own products" ON rls_test.products;

DROP POLICY IF EXISTS "Users can delete own data" ON rls_test.user_profiles;
DROP POLICY IF EXISTS "Users can insert own data" ON rls_test.user_profiles;
DROP POLICY IF EXISTS "Users can update own data" ON rls_test.user_profiles;
DROP POLICY IF EXISTS "Users can view own data" ON rls_test.user_profiles;

-- Drop tables
DROP TABLE IF EXISTS rls_test.products;
DROP TABLE IF EXISTS rls_test.user_profiles;

-- Drop schemas
DROP SCHEMA IF EXISTS rls_test;
DROP SCHEMA IF EXISTS auth;
