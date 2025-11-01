\echo Use "CREATE EXTENSION launchql-rls-demo" to load this file. \quit
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $EOFCODE$
  SELECT COALESCE(
    current_setting('jwt.claims.user_id', true)::uuid,
    current_setting('jwt.claims.sub', true)::uuid
  );
$EOFCODE$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $EOFCODE$
  SELECT COALESCE(
    current_setting('role', true),
    'anon'
  );
$EOFCODE$;

GRANT USAGE ON SCHEMA auth TO PUBLIC;

GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

GRANT EXECUTE ON FUNCTION auth.role() TO PUBLIC;

CREATE SCHEMA IF NOT EXISTS rls_test;

CREATE TABLE IF NOT EXISTS rls_test.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rls_test.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL,
  owner_id uuid NOT NULL REFERENCES rls_test.users (id)
    ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE rls_test.users 
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE rls_test.products 
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON rls_test.users
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
  USING (
    auth.uid() = id
  );

CREATE POLICY "Users can update own data"
  ON rls_test.users
  AS PERMISSIVE
  FOR UPDATE
  TO PUBLIC
  USING (
    auth.uid() = id
  );

CREATE POLICY "Users can insert own data"
  ON rls_test.users
  AS PERMISSIVE
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    true
  );

CREATE POLICY "Users can delete own data"
  ON rls_test.users
  AS PERMISSIVE
  FOR DELETE
  TO PUBLIC
  USING (
    auth.uid() = id
  );

CREATE POLICY "Users can view own products"
  ON rls_test.products
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
  USING (
    auth.uid() = owner_id
  );

CREATE POLICY "Users can insert own products"
  ON rls_test.products
  AS PERMISSIVE
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    auth.uid() = owner_id
  );

CREATE POLICY "Users can update own products"
  ON rls_test.products
  AS PERMISSIVE
  FOR UPDATE
  TO PUBLIC
  USING (
    auth.uid() = owner_id
  );

CREATE POLICY "Users can delete own products"
  ON rls_test.products
  AS PERMISSIVE
  FOR DELETE
  TO PUBLIC
  USING (
    auth.uid() = owner_id
  );

GRANT USAGE ON SCHEMA rls_test TO anon;

GRANT ALL ON rls_test.users TO anon;

GRANT USAGE ON SCHEMA rls_test TO authenticated;

GRANT ALL ON rls_test.users TO authenticated;

GRANT ALL ON rls_test.products TO authenticated;

GRANT USAGE ON SCHEMA rls_test TO service_role;

GRANT ALL ON rls_test.users TO service_role;

GRANT ALL ON rls_test.products TO service_role;

CREATE INDEX IF NOT EXISTS idx_products_owner_id ON rls_test.products (owner_id);

CREATE INDEX IF NOT EXISTS idx_users_email ON rls_test.users (email);

CREATE OR REPLACE FUNCTION rls_test.update_updated_at_column() RETURNS trigger AS $EOFCODE$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$EOFCODE$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE
  ON rls_test.users
  FOR EACH ROW
  EXECUTE PROCEDURE rls_test.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE
  ON rls_test.products
  FOR EACH ROW
  EXECUTE PROCEDURE rls_test.update_updated_at_column();