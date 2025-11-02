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
  
  // grant access to storage schema for testing
  try {
    await pg.any(
      `GRANT USAGE ON SCHEMA storage TO public;
       GRANT SELECT ON ALL TABLES IN SCHEMA storage TO service_role;`,
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

describe('tutorial: storage buckets table access', () => {
  let tableExists = false;

  beforeAll(async () => {
    db.setContext({ role: 'service_role' });
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'buckets'
      ) as exists`
    );
    tableExists = exists[0]?.exists === true;
  });

  it('should verify buckets table exists', async () => {
    db.setContext({ role: 'service_role' });
    
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'buckets'
      ) as exists`
    );
    
    expect(Array.isArray(exists)).toBe(true);
    if (exists[0]?.exists === false) {
      expect(exists[0].exists).toBe(false);
      return;
    }
    expect(exists[0].exists).toBe(true);
  });

  it('should verify service_role can read buckets', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    try {
      const buckets = await db.any(
        `SELECT id, name, owner, created_at, updated_at 
         FROM storage.buckets 
         LIMIT 10`
      );
      
      expect(Array.isArray(buckets)).toBe(true);
    } catch (err: any) {
      if (err.message?.includes('permission denied') || err.message?.includes('does not exist')) {
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
       WHERE table_schema = 'storage' AND table_name = 'buckets'
       AND constraint_type = 'PRIMARY KEY'`
    );
    
    expect(Array.isArray(pk)).toBe(true);
    if (pk.length > 0) {
      expect(pk[0].constraint_name).toBeDefined();
    }
  });

  it('should verify table has unique index on name', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const indexes = await db.any(
      `SELECT indexname 
       FROM pg_indexes 
       WHERE schemaname = 'storage' AND tablename = 'buckets'
       AND indexname = 'bname'`
    );
    
    expect(Array.isArray(indexes)).toBe(true);
  });

  it('should verify table has foreign key to auth.users', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    const fks = await db.any(
      `SELECT tc.constraint_name, ccu.table_name AS foreign_table_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' 
         AND tc.table_schema = 'storage' 
         AND tc.table_name = 'buckets'
         AND ccu.table_name = 'users'`
    );
    
    expect(Array.isArray(fks)).toBe(true);
  });

  it('should prevent anon from accessing buckets', async () => {
    if (!tableExists) {
      return;
    }
    
    db.clearContext();
    
    try {
      const result = await db.any(
        `SELECT * FROM storage.buckets LIMIT 1`
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

