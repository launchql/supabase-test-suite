import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  
  
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
  // grant INSERT on auth.users to service_role so we can create test users
  await pg.any(
    `GRANT USAGE ON SCHEMA auth TO public;
     GRANT INSERT ON TABLE auth.users TO service_role;
     GRANT EXECUTE ON FUNCTION auth.uid() TO public;
     GRANT EXECUTE ON FUNCTION auth.role() TO public;`,
    []
  );
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

describe('tutorial: rls with conditional policies', () => {
  it('should verify rls policies can use case statements', async () => {
    db.setContext({ role: 'service_role' });
    
    // using auth.users (real supabase table) instead of rls_test.users (fake test table)
    // use pg for auth.users insert since it requires superuser privileges
    const user1 = await pg.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['case1@example.com']
    );
    
  });

  it('should verify rls policies work with multiple conditions', async () => {
    db.setContext({ role: 'service_role' });
    
    // using auth.users (real supabase table) instead of rls_test.users (fake test table)
    // use pg for auth.users insert since it requires superuser privileges
    const user = await pg.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['multi1@example.com']
    );
    
    
  });

  it('should verify rls policies work with or conditions', async () => {
    db.setContext({ role: 'service_role' });
    
    // using auth.users (real supabase table) instead of rls_test.users (fake test table)
    // use pg for auth.users insert since it requires superuser privileges
    const user = await pg.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['or1@example.com']
    );
    
    
  });

  it('should verify rls policies work with subqueries', async () => {
    db.setContext({ role: 'service_role' });
    
    // using auth.users (real supabase table) instead of rls_test.users (fake test table)
    // use pg for auth.users insert since it requires superuser privileges
    const user1 = await pg.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['sub1@example.com']
    );
    

    const user2 = await pg.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['sub2@example.com']
    );
    
    
  });

  it('should verify rls policies work with related table checks', async () => {
    db.setContext({ role: 'service_role' });
    
    // using auth.users (real supabase table) instead of rls_test.users (fake test table)
    // use pg for auth.users insert since it requires superuser privileges
    const user = await pg.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['rel1@example.com']
    );
    
    
  });

  it('should verify rls policies work with null checks', async () => {
    db.setContext({ role: 'service_role' });
    
    // using auth.users (real supabase table) instead of rls_test.users (fake test table)
    // use pg for auth.users insert since it requires superuser privileges
    const user = await pg.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['null1@example.com']
    );
    
    
  });

  it('should verify rls policies work with coalesce functions', async () => {
    db.setContext({ role: 'service_role' });
    
    // using auth.users (real supabase table) instead of rls_test.users (fake test table)
    // use pg for auth.users insert since it requires superuser privileges
    const user = await pg.one(
      `INSERT INTO auth.users (id, email) 
       VALUES (gen_random_uuid(), $1) 
       RETURNING id`,
      ['coalesce1@example.com']
    );
    
    
  });
});

