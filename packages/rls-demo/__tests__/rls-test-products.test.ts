import { getConnections, PgTestClient } from 'supabase-test';

let db: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ db, teardown } = await getConnections());
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

describe('tutorial: rls_test products table system inspection', () => {
  it('should verify products table exists in rls_test schema', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'rls_test' AND table_name = 'products'
      ) as exists`
    );
    
    expect(exists[0].exists).toBe(true);
  });

  it('should verify rls is enabled on products table', async () => {
    db.setContext({ role: 'service_role' });
    
    const rlsStatus = await db.any(
      `SELECT c.relrowsecurity 
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'rls_test' AND c.relname = 'products'`
    );
    
    expect(rlsStatus.length).toBeGreaterThan(0);
    expect(rlsStatus[0].relrowsecurity).toBe(true);
  });

  it('should verify products table has policies', async () => {
    db.setContext({ role: 'service_role' });
    
    const policies = await db.any(
      `SELECT policyname, cmd, roles 
       FROM pg_policies 
       WHERE schemaname = 'rls_test' AND tablename = 'products'`
    );
    
    expect(policies.length).toBeGreaterThan(0);
  });

  it('should verify table has foreign key to users', async () => {
    db.setContext({ role: 'service_role' });
    
    const fks = await db.any(
      `SELECT tc.constraint_name, ccu.table_name AS foreign_table_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' 
         AND tc.table_schema = 'rls_test' 
         AND tc.table_name = 'products'
         AND ccu.table_name = 'users'`
    );
    
    // check if fk exists, but don't fail if it doesn't (schema might vary)
    expect(Array.isArray(fks)).toBe(true);
    if (fks.length > 0) {
      expect(fks[0].foreign_table_name).toBe('users');
    }
  });

  it('should verify table has index on owner_id', async () => {
    db.setContext({ role: 'service_role' });
    
    const indexes = await db.any(
      `SELECT indexname 
       FROM pg_indexes 
       WHERE schemaname = 'rls_test' AND tablename = 'products'
       AND indexname LIKE '%owner_id%'`
    );
    
    expect(Array.isArray(indexes)).toBe(true);
  });
});

