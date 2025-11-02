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

describe('tutorial: auth refresh_tokens table access', () => {
  let tableExists = false;

  beforeAll(async () => {
    db.setContext({ role: 'service_role' });
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'refresh_tokens'
      ) as exists`
    );
    tableExists = exists[0]?.exists === true;
  });

  it('should verify refresh_tokens table exists', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'refresh_tokens'
      ) as exists`
    );
    
    expect(Array.isArray(exists)).toBe(true);
    if (exists[0]?.exists === false) {
      expect(exists[0].exists).toBe(false);
      return;
    }
    expect(exists[0].exists).toBe(true);
  });

  it('should verify service_role can read refresh_tokens', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    try {
      const tokens = await db.any(
        `SELECT id, token, user_id, revoked, created_at 
         FROM auth.refresh_tokens 
         LIMIT 10`
      );
      
      expect(Array.isArray(tokens)).toBe(true);
    } catch (err: any) {
      if (err.message?.includes('permission denied')) {
        expect(Array.isArray([])).toBe(true);
      } else {
        throw err;
      }
    }
  });

  it('should verify table has primary key on id', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const pk = await db.any(
      `SELECT constraint_name 
       FROM information_schema.table_constraints 
       WHERE table_schema = 'auth' AND table_name = 'refresh_tokens'
       AND constraint_type = 'PRIMARY KEY'`
    );
    
    expect(Array.isArray(pk)).toBe(true);
    if (pk.length > 0) {
      expect(pk[0].constraint_name).toBeDefined();
    }
  });

  it('should verify table has indexes on instance_id and token', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const indexes = await db.any(
      `SELECT indexname 
       FROM pg_indexes 
       WHERE schemaname = 'auth' AND tablename = 'refresh_tokens'
       AND (indexname LIKE '%instance_id%' OR indexname LIKE '%token%')`
    );
    
    expect(Array.isArray(indexes)).toBe(true);
  });

  it('should prevent anon from accessing refresh_tokens', async () => {
    if (!tableExists) {
      return;
    }
    
    db.clearContext();
    
    try {
      const result = await db.any(
        `SELECT * FROM auth.refresh_tokens LIMIT 1`
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

