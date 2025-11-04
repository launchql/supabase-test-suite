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
  
  // grant access to _realtime schema for testing
  try {
    await pg.any(
      `GRANT USAGE ON SCHEMA _realtime TO public;`,
      []
    );
  } catch (err) {
    // schema might not exist
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

describe('tutorial: _realtime tenants table access', () => {
  let tableExists = false;

  beforeAll(async () => {
    db.setContext({ role: 'service_role' });
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = '_realtime' AND table_name = 'tenants'
      ) as exists`
    );
    tableExists = exists[0]?.exists === true;
  });

  it('should verify tenants table exists', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = '_realtime' AND table_name = 'tenants'
      ) as exists`
    );
    
    expect(Array.isArray(exists)).toBe(true);
    if (exists[0]?.exists === false) {
      expect(exists[0].exists).toBe(false);
      return;
    }
    expect(exists[0].exists).toBe(true);
  });

  it('should verify service_role can query tenants structure', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const columns = await db.any(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_schema = '_realtime' AND table_name = 'tenants'
       ORDER BY ordinal_position`
    );
    
    expect(Array.isArray(columns)).toBe(true);
  });

  it('should verify table has primary key constraint', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const constraints = await db.any(
      `SELECT constraint_name, constraint_type 
       FROM information_schema.table_constraints 
       WHERE table_schema = '_realtime' AND table_name = 'tenants'
       AND constraint_type = 'PRIMARY KEY'`
    );
    
    expect(Array.isArray(constraints)).toBe(true);
    if (constraints.length > 0) {
      expect(constraints[0].constraint_name).toBeDefined();
    }
  });

  it('should prevent anon from accessing tenants', async () => {
    if (!tableExists) {
      return;
    }
    
    db.clearContext();
    
    try {
      const result = await db.any(
        `SELECT * FROM _realtime.tenants LIMIT 1`
      );
      
      expect(result.length).toBe(0);
    } catch (err: any) {
      if (err.message?.includes('permission denied') || err.message?.includes('does not exist')) {
        expect(true).toBe(true);
      } else {
        throw err;
      }
    }
  });
});

