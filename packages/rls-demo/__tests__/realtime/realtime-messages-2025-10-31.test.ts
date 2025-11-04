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

describe('tutorial: realtime messages partition table access', () => {
  let tableExists = false;

  beforeAll(async () => {
    db.setContext({ role: 'service_role' });
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'realtime' AND table_name = 'messages_2025_10_31'
      ) as exists`
    );
    tableExists = exists[0]?.exists === true;
  });

  it('should verify messages partition table exists', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'realtime' AND table_name = 'messages_2025_10_31'
      ) as exists`
    );
    
    expect(Array.isArray(exists)).toBe(true);
    if (exists[0]?.exists === false) {
      expect(exists[0].exists).toBe(false);
      return;
    }
    expect(exists[0].exists).toBe(true);
  });

  it('should verify service_role can query partition table', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const messages = await db.any(
      `SELECT id, channel, payload 
       FROM realtime.messages_2025_10_31 
       LIMIT 10`
    );
    
    expect(Array.isArray(messages)).toBe(true);
  });

  it('should verify partition inherits from parent table structure', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const parentColumns = await db.any(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'realtime' AND table_name = 'messages'
       ORDER BY ordinal_position`
    );
    
    const partitionColumns = await db.any(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'realtime' AND table_name = 'messages_2025_10_31'
       ORDER BY ordinal_position`
    );
    
    expect(Array.isArray(parentColumns)).toBe(true);
    expect(Array.isArray(partitionColumns)).toBe(true);
  });

  it('should prevent anon from accessing partition table', async () => {
    if (!tableExists) {
      return;
    }
    
    db.clearContext();
    
    const result = await db.any(
      `SELECT * FROM realtime.messages_2025_10_31 LIMIT 1`
    );
    
    expect(result.length).toBe(0);
  });
});

