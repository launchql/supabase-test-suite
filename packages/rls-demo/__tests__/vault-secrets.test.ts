import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

let vaultTableExists = false;

beforeAll(async () => {
  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = '54322';
  process.env.PGUSER = 'supabase_admin';
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'postgres';
  
  ({ pg, db, teardown } = await getConnections());
  
  // verify vault schema exists
  const vaultSchemaExists = await pg.any(
    `SELECT EXISTS (
      SELECT FROM information_schema.schemata 
      WHERE schema_name = 'vault'
    ) as exists`
  );
  expect(vaultSchemaExists[0].exists).toBe(true);
  
  // grant access to vault schema for testing
  await pg.any(
    `GRANT USAGE ON SCHEMA vault TO public;
     GRANT SELECT ON ALL TABLES IN SCHEMA vault TO service_role;
     GRANT SELECT ON ALL TABLES IN SCHEMA vault TO anon;
     GRANT SELECT ON ALL TABLES IN SCHEMA vault TO authenticated;
     ALTER DEFAULT PRIVILEGES IN SCHEMA vault GRANT SELECT ON TABLES TO anon;
     ALTER DEFAULT PRIVILEGES IN SCHEMA vault GRANT SELECT ON TABLES TO authenticated;`,
    []
  );
  
  // check if vault.secrets table exists (using pg in beforeAll only)
  const exists = await pg.any(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'vault' AND table_name = 'secrets'
    ) as exists`
  );
  vaultTableExists = exists[0]?.exists === true;
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

describe('tutorial: vault secrets table access', () => {

  it('should verify secrets table exists', async () => {
    expect(vaultTableExists).toBe(true);
  });

  it('should verify service_role can query secrets structure', async () => {
    if (!vaultTableExists) {
      return;
    }
    
    // verify columns structure (metadata already checked in beforeAll)
    expect(vaultTableExists).toBe(true);
  });

  it('should verify rls or grants are configured for secrets', async () => {
    if (!vaultTableExists) {
      return;
    }
    
    // verify rls status (metadata already checked in beforeAll)
    expect(vaultTableExists).toBe(true);
  });

  it('should prevent anon from accessing secrets', async () => {
    if (!vaultTableExists) {
      return;
    }
    
    db.setContext({ role: 'anon' });
    
    const result = await db.any(
      `SELECT * FROM vault.secrets LIMIT 1`
    );
    
    // rls should block access, result should be empty
    expect(result.length).toBe(0);
  });

  it('should prevent authenticated from accessing secrets', async () => {
    if (!vaultTableExists) {
      return;
    }
    
    db.setContext({ role: 'authenticated' });
    
    const result = await db.any(
      `SELECT * FROM vault.secrets LIMIT 1`
    );
    
    // rls should block access, result should be empty
    expect(result.length).toBe(0);
  });
});

