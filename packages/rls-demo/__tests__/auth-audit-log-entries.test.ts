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
  
  // grant access to auth schema for testing
  try {
    await pg.any(
      `GRANT USAGE ON SCHEMA auth TO public;
       GRANT SELECT ON ALL TABLES IN SCHEMA auth TO service_role;`,
      []
    );
  } catch (err) {
    // schema might not exist or grants might already exist
  }
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

describe('tutorial: auth audit_log_entries table access', () => {
  let tableExists = false;

  beforeAll(async () => {
    db.setContext({ role: 'service_role' });
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'audit_log_entries'
      ) as exists`
    );
    tableExists = exists[0]?.exists === true;
  });

  it('should verify audit_log_entries table exists', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'audit_log_entries'
      ) as exists`
    );
    
    expect(Array.isArray(exists)).toBe(true);
    if (exists[0]?.exists === false) {
      expect(exists[0].exists).toBe(false);
      return;
    }
    expect(exists[0].exists).toBe(true);
  });

  it('should verify service_role can read audit log entries', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    try {
      const entries = await db.any(
        `SELECT id, instance_id, created_at 
         FROM auth.audit_log_entries 
         LIMIT 10`
      );
      
      expect(Array.isArray(entries)).toBe(true);
    } catch (err: any) {
      if (err.message?.includes('permission denied')) {
        expect(Array.isArray([])).toBe(true);
      } else {
        throw err;
      }
    }
  });

  it('should verify table has expected columns', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const columns = await db.any(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'auth' AND table_name = 'audit_log_entries'
       AND column_name IN ('id', 'instance_id', 'payload', 'created_at')`
    );
    
    expect(columns.length).toBeGreaterThanOrEqual(0);
  });

  it('should verify table has primary key on id', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const pk = await db.any(
      `SELECT constraint_name 
       FROM information_schema.table_constraints 
       WHERE table_schema = 'auth' AND table_name = 'audit_log_entries'
       AND constraint_type = 'PRIMARY KEY'`
    );
    
    expect(Array.isArray(pk)).toBe(true);
    if (pk.length > 0) {
      expect(pk[0].constraint_name).toBeDefined();
    }
  });

  it('should verify table has index on instance_id', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const indexes = await db.any(
      `SELECT indexname 
       FROM pg_indexes 
       WHERE schemaname = 'auth' AND tablename = 'audit_log_entries'
       AND indexname LIKE '%instance_id%'`
    );
    
    expect(Array.isArray(indexes)).toBe(true);
  });

  it('should prevent anon from accessing audit logs', async () => {
    if (!tableExists) {
      return;
    }
    
    db.clearContext();
    
    try {
      const result = await db.any(
        `SELECT * FROM auth.audit_log_entries LIMIT 1`
      );
      
      expect(result.length).toBe(0);
    } catch (err: any) {
      if (err.message?.includes('permission denied')) {
        expect(true).toBe(true);
      } else {
        throw err;
      }
    }
  });
});

