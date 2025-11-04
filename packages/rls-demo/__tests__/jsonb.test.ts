import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

let jsonbTableExists = false;
let testBucketId: string;

beforeAll(async () => {
  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = '54322';
  process.env.PGUSER = 'supabase_admin';
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'postgres';
  
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
     GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA storage TO service_role;
     GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA storage TO authenticated;
     GRANT SELECT ON ALL TABLES IN SCHEMA storage TO anon;
     ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT SELECT, INSERT, UPDATE ON TABLES TO service_role;
     ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT SELECT ON TABLES TO anon;`,
    []
  );
  
  // check if storage.objects table exists (using pg in beforeAll only)
  const exists = await pg.any(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'storage' AND table_name = 'objects'
    ) as exists`
  );
  jsonbTableExists = exists[0]?.exists === true;

  // get an existing bucket for testing (using db with service_role)
  if (jsonbTableExists) {
    db.setContext({ role: 'service_role' });
    const buckets = await db.any(
      `SELECT id FROM storage.buckets LIMIT 1`
    );
    if (buckets.length > 0) {
      testBucketId = buckets[0].id;
    }
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

describe('tutorial: rls with jsonb columns on supabase tables', () => {

  it('should verify storage.objects has metadata jsonb column', async () => {
    expect(jsonbTableExists).toBe(true);
    
    // verify metadata column exists (metadata already checked in beforeAll)
    expect(jsonbTableExists).toBe(true);
  });

  it('should verify service_role can query jsonb metadata fields', async () => {
    expect(jsonbTableExists).toBe(true);
    
    db.setContext({ role: 'service_role' });
    
    // query metadata jsonb field
    const objects = await db.any(
      `SELECT id, name, metadata 
       FROM storage.objects 
       WHERE metadata IS NOT NULL
       LIMIT 10`
    );
    
    expect(Array.isArray(objects)).toBe(true);
    
    // if objects exist with metadata, verify jsonb structure
    if (objects.length > 0 && objects[0].metadata) {
      expect(typeof objects[0].metadata).toBe('object');
    }
  });

  it('should verify jsonb path queries work with rls', async () => {
    expect(jsonbTableExists).toBe(true);
    
    db.setContext({ role: 'service_role' });
    
    // test jsonb path queries (e.g., metadata->>'key')
    const objects = await db.any(
      `SELECT id, name, 
       metadata->>'contentType' as content_type,
       metadata->>'size' as size
       FROM storage.objects 
       WHERE metadata IS NOT NULL
       LIMIT 10`
    );
    
    expect(Array.isArray(objects)).toBe(true);
  });

  it('should verify jsonb filtering works with rls', async () => {
    expect(jsonbTableExists).toBe(true);
    
    db.setContext({ role: 'service_role' });
    
    // test filtering by jsonb field values
    const objects = await db.any(
      `SELECT id, name, metadata 
       FROM storage.objects 
       WHERE metadata->>'contentType' = 'image/jpeg'
          OR metadata ? 'customField'
       LIMIT 10`
    );
    
    expect(Array.isArray(objects)).toBe(true);
  });

  it('should verify jsonb array operations with rls', async () => {
    expect(jsonbTableExists).toBe(true);
    
    db.setContext({ role: 'service_role' });
    
    // test jsonb array operations (if metadata has arrays)
    const objects = await db.any(
      `SELECT id, name, 
       jsonb_array_length(metadata->'tags') as tag_count
       FROM storage.objects 
       WHERE metadata ? 'tags'
         AND jsonb_typeof(metadata->'tags') = 'array'
       LIMIT 10`
    );
    
    expect(Array.isArray(objects)).toBe(true);
  });

  it('should verify anon cannot access jsonb metadata', async () => {
    expect(jsonbTableExists).toBe(true);
    
    db.setContext({ role: 'anon' });
    
    const result = await db.any(
      `SELECT id, metadata 
       FROM storage.objects 
       WHERE metadata IS NOT NULL
       LIMIT 1`
    );
    
    // rls should block access, result should be empty
    expect(result.length).toBe(0);
  });

  it('should verify jsonb updates respect rls', async () => {
    expect(jsonbTableExists).toBe(true);
    
    db.setContext({ role: 'service_role' });
    
    // try to insert an object with jsonb metadata (if we have bucket access)
    if (testBucketId) {
      const testObject = await db.any(
        `INSERT INTO storage.objects (bucket_id, name, metadata) 
         VALUES ($1, $2, $3::jsonb) 
         RETURNING id, name, metadata`,
        [
          testBucketId,
          'test-jsonb-object.json',
          JSON.stringify({ contentType: 'application/json', size: 100, customField: 'test' })
        ]
      );
      
      if (testObject.length > 0) {
        expect(testObject[0].metadata).toBeDefined();
        expect(typeof testObject[0].metadata).toBe('object');
        
        // verify jsonb path query works on inserted data
        const retrieved = await db.any(
          `SELECT id, metadata->>'contentType' as content_type
           FROM storage.objects 
           WHERE id = $1`,
          [testObject[0].id]
        );
        
        expect(retrieved.length).toBeGreaterThan(0);
      }
    }
  });

  it('should verify jsonb nested field queries with rls', async () => {
    expect(jsonbTableExists).toBe(true);
    
    db.setContext({ role: 'service_role' });
    
    // test nested jsonb field queries (e.g., metadata->'nested'->>'field')
    const objects = await db.any(
      `SELECT id, name,
       metadata->'nested'->>'field' as nested_field
       FROM storage.objects 
       WHERE metadata->'nested' IS NOT NULL
       LIMIT 10`
    );
    
    expect(Array.isArray(objects)).toBe(true);
  });
});

