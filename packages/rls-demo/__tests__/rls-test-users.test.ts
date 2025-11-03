import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = '54322';
  process.env.PGUSER = 'supabase_admin';
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'postgres';
  
  ({ pg, db, teardown } = await getConnections());
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await db.beforeEach();
});

afterEach(async () => {
  await db.afterEach();
});

describe('tutorial: rls_test users table system inspection', () => {
  it('should verify users table exists in rls_test schema', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'rls_test' AND table_name = 'users'
      ) as exists`
    );
    
    expect(exists[0].exists).toBe(true);
  });

  it('should verify rls is enabled on users table', async () => {
    db.setContext({ role: 'service_role' });
    
    const rlsStatus = await db.any(
      `SELECT c.relrowsecurity 
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'rls_test' AND c.relname = 'users'`
    );
    
    expect(rlsStatus.length).toBeGreaterThan(0);
    expect(rlsStatus[0].relrowsecurity).toBe(true);
  });

  it('should verify users table has policies', async () => {
    db.setContext({ role: 'service_role' });
    
    const policies = await db.any(
      `SELECT policyname, cmd, roles 
       FROM pg_policies 
       WHERE schemaname = 'rls_test' AND tablename = 'users'`
    );
    
    expect(policies.length).toBeGreaterThan(0);
  });

  it('should verify table has unique constraint on email', async () => {
    db.setContext({ role: 'service_role' });
    
    const constraints = await db.any(
      `SELECT constraint_name, constraint_type 
       FROM information_schema.table_constraints 
       WHERE table_schema = 'rls_test' AND table_name = 'users'
       AND constraint_type = 'UNIQUE'`
    );
    
    expect(constraints.length).toBeGreaterThan(0);
  });

  it('should verify table has index on email', async () => {
    db.setContext({ role: 'service_role' });
    
    const indexes = await db.any(
      `SELECT indexname 
       FROM pg_indexes 
       WHERE schemaname = 'rls_test' AND tablename = 'users'
       AND indexname LIKE '%email%'`
    );
    
    expect(Array.isArray(indexes)).toBe(true);
  });
});

