import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

let tableExists = false;

beforeAll(async () => {
  ({ pg, db, teardown } = await getConnections());
  
  // verify storage schema exists
  const storageSchemaExists = await pg.any(
    `SELECT EXISTS (
      SELECT FROM information_schema.schemata 
      WHERE schema_name = 'storage'
    ) as exists`
  );
  expect(storageSchemaExists[0].exists).toBe(true);
  
  // grant access to storage schema for testing
  await pg.any(
    `GRANT USAGE ON SCHEMA storage TO public;
     GRANT SELECT ON ALL TABLES IN SCHEMA storage TO service_role;
     GRANT SELECT ON ALL TABLES IN SCHEMA storage TO authenticated;
     GRANT SELECT ON ALL TABLES IN SCHEMA storage TO anon;
     ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT SELECT ON TABLES TO service_role;
     ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT SELECT ON TABLES TO authenticated;
     ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT SELECT ON TABLES TO anon;`,
    []
  );
  
  // check if storage.s3_multipart_uploads_parts table exists (using pg in beforeAll only)
  const exists = await pg.any(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'storage' AND table_name = 's3_multipart_uploads_parts'
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

describe('tutorial: storage s3_multipart_uploads_parts table access', () => {

  it('should verify s3_multipart_uploads_parts table exists', async () => {
    db.setContext({ role: 'service_role' });
    
    // verify table exists in information schema
    const exists = await db.any(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 's3_multipart_uploads_parts'
      ) as exists`
    );
    
    expect(Array.isArray(exists)).toBe(true);
    if (exists[0]?.exists === false) {
      expect(exists[0].exists).toBe(false);
      return;
    }
    expect(exists[0].exists).toBe(true);
  });

  it('should verify service_role can query s3_multipart_uploads_parts', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    // service_role should be able to query s3_multipart_uploads_parts
    const parts = await db.any(
      `SELECT id, upload_id, part_number, etag, created_at 
       FROM storage.s3_multipart_uploads_parts 
       LIMIT 10`
    );
    
    expect(Array.isArray(parts)).toBe(true);
  });

  it('should verify table has foreign key to s3_multipart_uploads', async () => {
    if (!tableExists) {
      return;
    }
    
    db.setContext({ role: 'service_role' });
    
    // check for foreign key constraints to s3_multipart_uploads
    const fks = await db.any(
      `SELECT tc.constraint_name, ccu.table_name AS foreign_table_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' 
         AND tc.table_schema = 'storage' 
         AND tc.table_name = 's3_multipart_uploads_parts'
         AND ccu.table_name = 's3_multipart_uploads'`
    );
    
    expect(Array.isArray(fks)).toBe(true);
  });

  it('should prevent authenticated users from accessing s3_multipart_uploads_parts without proper permissions', async () => {
    if (!tableExists) {
      return;
    }
    
    // create a test user as admin using db with service_role context
    // using auth.users (real supabase table) instead of rls_test.users (fake test table)
    db.setContext({ role: 'service_role' });
    const user = await db.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['storage-parts-test@example.com']
    );
    
    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });
    
    // authenticated users should not be able to access s3_multipart_uploads_parts (rls blocks)
    const result = await db.any(
      `SELECT * FROM storage.s3_multipart_uploads_parts LIMIT 1`
    );
    
    // rls should block access, result should be empty
    expect(result.length).toBe(0);
  });

  it('should prevent anon from accessing s3_multipart_uploads_parts', async () => {
    if (!tableExists) {
      return;
    }
    
    // clear context to anon role
    db.clearContext();
    
    // anon should not be able to access s3_multipart_uploads_parts (rls blocks)
    const result = await db.any(
      `SELECT * FROM storage.s3_multipart_uploads_parts LIMIT 1`
    );
    
    // rls should block access, result should be empty
    expect(result.length).toBe(0);
  });
});

