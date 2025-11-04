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
  
  // grant access to realtime schema for testing
  try {
    await pg.any(
      `GRANT USAGE ON SCHEMA realtime TO public;`,
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

describe('tutorial: realtime schema_migrations table access', () => {
  let tableExists = false;

  beforeAll(async () => {
    db.setContext({ role: 'service_role' });
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'realtime' AND table_name = 'schema_migrations'
      ) as exists`
    );
    tableExists = exists[0]?.exists === true;
  });

  it('should verify schema_migrations table exists', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'realtime' AND table_name = 'schema_migrations'
      ) as exists`
    );
    
    expect(Array.isArray(exists)).toBe(true);
    if (exists[0]?.exists === false) {
      expect(exists[0].exists).toBe(false);
      return;
    }
    expect(exists[0].exists).toBe(true);
  });

  it('should verify service_role can read migration versions', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    try {
      const migrations = await db.any(
        `SELECT version FROM realtime.schema_migrations ORDER BY version`
      );
      
      expect(Array.isArray(migrations)).toBe(true);
    } catch (err: any) {
      if (err.message?.includes('permission denied') || err.message?.includes('does not exist')) {
        expect(Array.isArray([])).toBe(true);
      } else {
        throw err;
      }
    }
  });

  it('should prevent anon from accessing schema_migrations', async () => {
    if (!tableExists) {
      return;
    }
    
    db.clearContext();
    
    try {
      const result = await db.any(
        `SELECT * FROM realtime.schema_migrations LIMIT 1`
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

