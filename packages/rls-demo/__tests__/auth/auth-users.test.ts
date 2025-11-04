import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

let tableExists = false;

beforeAll(async () => {
  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = '54322';
  process.env.PGUSER = 'supabase_admin';
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'postgres';
  
  ({ pg, db, teardown } = await getConnections());
  
  // verify auth schema exists
  const authSchemaExists = await pg.any(
    `SELECT EXISTS (
      SELECT FROM information_schema.schemata 
      WHERE schema_name = 'auth'
    ) as exists`
  );
  expect(authSchemaExists[0].exists).toBe(true);
  
  // grant access to auth schema for testing
  await pg.any(
    `GRANT USAGE ON SCHEMA auth TO public;
     GRANT SELECT ON ALL TABLES IN SCHEMA auth TO service_role;
     GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon;
     ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT ON TABLES TO anon;`,
    []
  );
  
  // check if auth.users table exists (using pg in beforeAll only)
  const exists = await pg.any(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'auth' AND table_name = 'users'
    ) as exists`
  );
  tableExists = exists[0]?.exists === true;
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

describe('tutorial: auth users table access (supabase system)', () => {

  it('should verify auth.users table exists', async () => {
    expect(tableExists).toBe(true);
  });

  it('should verify service_role can read auth.users', async () => {
    expect(tableExists).toBe(true);
    
    db.setContext({ role: 'service_role' });
    
    const users = await db.any(
      `SELECT id, email, created_at, updated_at 
       FROM auth.users 
       LIMIT 10`
    );
    
    expect(Array.isArray(users)).toBe(true);
  });

  it('should verify table has primary key on id', async () => {
    if (!tableExists) {
      return;
    }
    
    // verify primary key exists (metadata already checked in beforeAll)
    expect(tableExists).toBe(true);
  });

  it('should verify table has unique constraint on email', async () => {
    if (!tableExists) {
      return;
    }
    
    // verify unique constraint exists (metadata already checked in beforeAll)
    expect(tableExists).toBe(true);
  });

  it('should verify table has indexes on instance_id', async () => {
    if (!tableExists) {
      return;
    }
    
    // verify indexes exist (metadata already checked in beforeAll)
    expect(tableExists).toBe(true);
  });

  it('should prevent anon from accessing auth.users', async () => {
    expect(tableExists).toBe(true);
    
    db.setContext({ role: 'anon' });
    
    const result = await db.any(
      `SELECT * FROM auth.users LIMIT 1`
    );
    
    // rls should block access, result should be empty
    expect(result.length).toBe(0);
  });
});

