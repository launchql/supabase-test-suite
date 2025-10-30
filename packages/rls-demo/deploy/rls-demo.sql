-- Deploy: rls-demo to pg
-- made with <3 @ launchql.com

-- Create auth schema for RLS testing
CREATE SCHEMA IF NOT EXISTS auth;

-- Create uid() function for RLS policies
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('jwt.claims.user_id', true)::uuid,
    current_setting('jwt.claims.sub', true)::uuid
  );
$$;

-- Create role() function for RLS policies
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('role', true),
    'anon'
  );
$$;

-- Grant permissions on auth schema and functions to public
GRANT USAGE ON SCHEMA auth TO public;
GRANT EXECUTE ON FUNCTION auth.uid() TO public;
GRANT EXECUTE ON FUNCTION auth.role() TO public;

















-- Create rls_test schema
CREATE SCHEMA IF NOT EXISTS rls_test;

-- Create users table
CREATE TABLE IF NOT EXISTS rls_test.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table with owner_id foreign key
CREATE TABLE IF NOT EXISTS rls_test.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    owner_id UUID NOT NULL REFERENCES rls_test.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE rls_test.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_test.products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
-- Users can view their own data
CREATE POLICY "Users can view own data" ON rls_test.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON rls_test.users
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own data
CREATE POLICY "Users can insert own data" ON rls_test.users
    FOR INSERT WITH CHECK (true);

-- Users can delete their own data
CREATE POLICY "Users can delete own data" ON rls_test.users
    FOR DELETE USING (auth.uid() = id);

-- Create RLS policies for products table
-- Users can view products they own
CREATE POLICY "Users can view own products" ON rls_test.products
    FOR SELECT USING (auth.uid() = owner_id);

-- Users can insert products they own
CREATE POLICY "Users can insert own products" ON rls_test.products
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Users can update products they own
CREATE POLICY "Users can update own products" ON rls_test.products
    FOR UPDATE USING (auth.uid() = owner_id);

-- Users can delete products they own
CREATE POLICY "Users can delete own products" ON rls_test.products
    FOR DELETE USING (auth.uid() = owner_id);

-- Grant permissions to anon users
GRANT USAGE ON SCHEMA rls_test TO anon;
GRANT ALL ON rls_test.users TO anon;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA rls_test TO authenticated;
GRANT ALL ON rls_test.users TO authenticated;
GRANT ALL ON rls_test.products TO authenticated;

-- Grant permissions to service role (for admin operations)
GRANT USAGE ON SCHEMA rls_test TO service_role;
GRANT ALL ON rls_test.users TO service_role;
GRANT ALL ON rls_test.products TO service_role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON rls_test.products(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON rls_test.users(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION rls_test.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON rls_test.users
    FOR EACH ROW
    EXECUTE FUNCTION rls_test.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON rls_test.products
    FOR EACH ROW
    EXECUTE FUNCTION rls_test.update_updated_at_column();
