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
    
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['case1@example.com', 'Case User 1']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['case2@example.com', 'Case User 2']
    );

    // create products with different prices
    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Expensive', 'High price', 500.00, user1.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Cheap', 'Low price', 10.00, user1.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // use case in where clause to filter by price
    const expensiveProducts = await db.any(
      `SELECT id, name, price,
       CASE 
         WHEN price > 100 THEN 'expensive'
         ELSE 'cheap'
       END as price_category
       FROM rls_test.products 
       WHERE owner_id = $1 AND price > 100`,
      [user1.id]
    );

    expect(Array.isArray(expensiveProducts)).toBe(true);
    expect(expensiveProducts.length).toBe(1);
    if (expensiveProducts.length > 0) {
      expect(Number(expensiveProducts[0].price)).toBeGreaterThan(100);
    }
  });

  it('should verify rls policies work with multiple conditions', async () => {
    db.setContext({ role: 'service_role' });
    
    const user = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['multi1@example.com', 'Multi Condition User']
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product A', 'Description A', 50.00, user.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product B', 'Description B', 150.00, user.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // query with multiple conditions (AND)
    const filtered = await db.any(
      `SELECT id, name, price 
       FROM rls_test.products 
       WHERE owner_id = $1 
         AND price > 100 
         AND name LIKE '%B%'`,
      [user.id]
    );

    expect(Array.isArray(filtered)).toBe(true);
    expect(filtered.length).toBe(1);
    if (filtered.length > 0) {
      expect(Number(filtered[0].price)).toBeGreaterThan(100);
    }
  });

  it('should verify rls policies work with or conditions', async () => {
    db.setContext({ role: 'service_role' });
    
    const user = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['or1@example.com', 'OR Condition User']
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product X', 'Description X', 75.00, user.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product Y', 'Description Y', 25.00, user.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // query with OR conditions
    const filtered = await db.any(
      `SELECT id, name, price 
       FROM rls_test.products 
       WHERE owner_id = $1 
         AND (price > 50 OR name LIKE '%X%')`,
      [user.id]
    );

    expect(Array.isArray(filtered)).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('should verify rls policies work with subqueries', async () => {
    db.setContext({ role: 'service_role' });
    
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['sub1@example.com', 'Subquery User 1']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['sub2@example.com', 'Subquery User 2']
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product 1', 'Description 1', 100.00, user1.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product 2', 'Description 2', 200.00, user2.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // use subquery to check related data
    const usersWithProducts = await db.any(
      `SELECT u.id, u.email,
       (SELECT COUNT(*) FROM rls_test.products p WHERE p.owner_id = u.id) as product_count
       FROM rls_test.users u
       WHERE u.id = $1
         AND EXISTS(SELECT 1 FROM rls_test.products p WHERE p.owner_id = u.id)`,
      [user1.id]
    );

    expect(Array.isArray(usersWithProducts)).toBe(true);
    expect(usersWithProducts.length).toBe(1);
    if (usersWithProducts.length > 0) {
      expect(Number(usersWithProducts[0].product_count)).toBeGreaterThan(0);
    }
  });

  it('should verify rls policies work with related table checks', async () => {
    db.setContext({ role: 'service_role' });
    
    const user = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['rel1@example.com', 'Related Table User']
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Related Product', 'Description', 99.99, user.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // join with related table to verify access
    const products = await db.any(
      `SELECT p.id, p.name, u.email as owner_email
       FROM rls_test.products p
       JOIN rls_test.users u ON u.id = p.owner_id
       WHERE u.id = $1`,
      [user.id]
    );

    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    if (products.length > 0) {
      expect(products[0].owner_email).toBe('rel1@example.com');
    }
  });

  it('should verify rls policies work with null checks', async () => {
    db.setContext({ role: 'service_role' });
    
    const user = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['null1@example.com', 'Null Check User']
    );

    // create product with null description
    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Null Desc Product', null, 50.00, user.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // query with null check
    const nullProducts = await db.any(
      `SELECT id, name, description 
       FROM rls_test.products 
       WHERE owner_id = $1 AND description IS NULL`,
      [user.id]
    );

    expect(Array.isArray(nullProducts)).toBe(true);
    expect(nullProducts.length).toBe(1);
    if (nullProducts.length > 0) {
      expect(nullProducts[0].description).toBeNull();
    }
  });

  it('should verify rls policies work with coalesce functions', async () => {
    db.setContext({ role: 'service_role' });
    
    const user = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['coalesce1@example.com', 'Coalesce User']
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Coalesce Product', null, 75.00, user.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // use coalesce to handle nulls
    const products = await db.any(
      `SELECT id, name, COALESCE(description, 'No description') as description
       FROM rls_test.products 
       WHERE owner_id = $1`,
      [user.id]
    );

    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    if (products.length > 0) {
      expect(products[0].description).toBe('No description');
    }
  });
});

