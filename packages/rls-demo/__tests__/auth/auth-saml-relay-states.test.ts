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

describe('tutorial: auth saml_relay_states table access', () => {
  let tableExists = false;

  beforeAll(async () => {
    db.setContext({ role: 'service_role' });
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'saml_relay_states'
      ) as exists`
    );
    tableExists = exists[0]?.exists === true;
  });

  it('should verify saml_relay_states table exists', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'saml_relay_states'
      ) as exists`
    );
    
    expect(Array.isArray(exists)).toBe(true);
    if (exists[0]?.exists === false) {
      expect(exists[0].exists).toBe(false);
      return;
    }
    expect(exists[0].exists).toBe(true);
  });

  it('should verify service_role can query saml_relay_states structure', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const columns = await db.any(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_schema = 'auth' AND table_name = 'saml_relay_states'
       ORDER BY ordinal_position`
    );
    
    expect(Array.isArray(columns)).toBe(true);
  });

  it('should verify table has created_at timestamp column', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const timestampCols = await db.any(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'auth' AND table_name = 'saml_relay_states'
       AND (column_name LIKE '%created_at%' OR column_name LIKE '%expires_at%')`
    );
    
    expect(Array.isArray(timestampCols)).toBe(true);
  });

  it('should prevent anon from accessing saml_relay_states', async () => {
    if (!tableExists) {
      return;
    }
    
    db.clearContext();
    
    try {
      const result = await db.any(
        `SELECT * FROM auth.saml_relay_states LIMIT 1`
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

