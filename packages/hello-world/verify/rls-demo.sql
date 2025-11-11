-- Verify: rls-demo on pg

-- Verify schema exists
SELECT 1 FROM information_schema.schemata WHERE schema_name = 'rls_test';

-- Verify pets table exists with correct structure
SELECT 1 FROM information_schema.tables 
WHERE table_schema = 'rls_test' AND table_name = 'pets';

SELECT 1 FROM information_schema.columns 
WHERE table_schema = 'rls_test' AND table_name = 'pets' AND column_name = 'id';

SELECT 1 FROM information_schema.columns 
WHERE table_schema = 'rls_test' AND table_name = 'pets' AND column_name = 'user_id';

SELECT 1 FROM information_schema.columns 
WHERE table_schema = 'rls_test' AND table_name = 'pets' AND column_name = 'name';

SELECT 1 FROM information_schema.columns 
WHERE table_schema = 'rls_test' AND table_name = 'pets' AND column_name = 'breed';

SELECT 1 FROM information_schema.columns 
WHERE table_schema = 'rls_test' AND table_name = 'pets' AND column_name = 'created_at';

SELECT 1 FROM information_schema.columns 
WHERE table_schema = 'rls_test' AND table_name = 'pets' AND column_name = 'updated_at';

-- Verify foreign key constraint
SELECT 1 FROM information_schema.table_constraints 
WHERE table_schema = 'rls_test' 
AND table_name = 'pets' 
AND constraint_type = 'FOREIGN KEY'
AND constraint_name LIKE '%user_id%';

-- Verify RLS is enabled
SELECT 1 FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'rls_test' 
AND c.relname = 'pets' 
AND c.relrowsecurity = true;

-- Verify policies exist
SELECT 1 FROM pg_policies 
WHERE schemaname = 'rls_test' 
AND tablename = 'pets' 
AND policyname = 'Users can view own data';

SELECT 1 FROM pg_policies 
WHERE schemaname = 'rls_test' 
AND tablename = 'pets' 
AND policyname = 'Users can update own data';

SELECT 1 FROM pg_policies 
WHERE schemaname = 'rls_test' 
AND tablename = 'pets' 
AND policyname = 'Users can insert own data';

SELECT 1 FROM pg_policies 
WHERE schemaname = 'rls_test' 
AND tablename = 'pets' 
AND policyname = 'Users can delete own data';

-- Verify indexes exist
SELECT 1 FROM pg_indexes 
WHERE schemaname = 'rls_test' 
AND tablename = 'pets' 
AND indexname = 'idx_users_user_id';

-- Verify trigger function exists
SELECT 1 FROM information_schema.routines 
WHERE routine_schema = 'rls_test' 
AND routine_name = 'update_updated_at_column';

-- Verify triggers exist
SELECT 1 FROM information_schema.triggers 
WHERE trigger_schema = 'rls_test' 
AND trigger_name = 'update_users_updated_at';
