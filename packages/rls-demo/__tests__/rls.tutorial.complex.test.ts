import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  // use existing supabase database connection
  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = '54322';
  process.env.PGUSER = 'supabase_admin';
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'postgres';
  
  ({ pg, db, teardown } = await getConnections());
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

describe('tutorial: complex rls queries with joins and aggregations', () => {
  it('should allow user to query their own products with user details', async () => {
    // create user as admin
    const user = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['complex1@example.com', 'Complex User 1']
    );

    // create products for user
    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product A', 'Description A', 100.00, user.id]
    );

    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product B', 'Description B', 200.00, user.id]
    );

    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product C', 'Description C', 150.00, user.id]
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user.id
    });

    // user can query their own products with user details via join
    const result = await db.many(
      `SELECT 
         u.name as user_name,
         u.email as user_email,
         p.name as product_name,
         p.price as product_price
       FROM rls_test.users u
       JOIN rls_test.products p ON u.id = p.owner_id
       WHERE u.id = $1
       ORDER BY p.price DESC`,
      [user.id]
    );

    expect(result.length).toBe(3);
    expect(result[0].user_name).toBe('Complex User 1');
    expect(result[0].user_email).toBe('complex1@example.com');
    expect(result[0].product_price).toBe('200.00');
  });

  it('should allow user to aggregate their own product data', async () => {
    // create user as admin
    const user = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['complex2@example.com', 'Complex User 2']
    );

    // create products with different prices
    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Cheap Product', 'Low price', 10.00, user.id]
    );

    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Expensive Product', 'High price', 500.00, user.id]
    );

    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Medium Product', 'Mid price', 250.00, user.id]
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user.id
    });

    // user can aggregate their own product data
    const stats = await db.one(
      `SELECT 
         COUNT(*) as total_products,
         MIN(price) as min_price,
         MAX(price) as max_price,
         AVG(price) as avg_price,
         SUM(price) as total_value
       FROM rls_test.products
       WHERE owner_id = $1`,
      [user.id]
    );

    expect(Number(stats.total_products)).toBe(3);
    expect(Number(stats.min_price)).toBe(10.00);
    expect(Number(stats.max_price)).toBe(500.00);
    expect(Number(stats.avg_price)).toBeCloseTo(253.33, 2);
    expect(Number(stats.total_value)).toBe(760.00);
  });

  it('should filter products correctly when user queries with conditions', async () => {
    // create user as admin
    const user = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['complex3@example.com', 'Complex User 3']
    );

    // create products with different prices
    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Affordable Item', 'Under 100', 50.00, user.id]
    );

    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Mid Range Item', 'Over 100', 150.00, user.id]
    );

    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Premium Item', 'Over 200', 300.00, user.id]
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user.id
    });

    // user can filter their own products
    const expensiveProducts = await db.many(
      `SELECT name, price 
       FROM rls_test.products 
       WHERE owner_id = $1 AND price > 100
       ORDER BY price`,
      [user.id]
    );

    expect(expensiveProducts.length).toBe(2);
    expect(Number(expensiveProducts[0].price)).toBe(150.00);
    expect(Number(expensiveProducts[1].price)).toBe(300.00);
  });

  it('should respect rls when using subqueries', async () => {
    // create two users as admin
    const user1 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['complex4@example.com', 'Complex User 4']
    );

    const user2 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['complex5@example.com', 'Complex User 5']
    );

    // create products for both users
    await pg.any(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4)`,
      ['User1 Product', 'User1 owns', 100.00, user1.id]
    );

    await pg.any(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4)`,
      ['User2 Product', 'User2 owns', 200.00, user2.id]
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user1.id
    });

    // user1 can use subquery to get their own products only
    const result = await db.many(
      `SELECT 
         u.name,
         (SELECT COUNT(*) FROM rls_test.products p WHERE p.owner_id = u.id) as product_count,
         (SELECT SUM(price) FROM rls_test.products p WHERE p.owner_id = u.id) as total_value
       FROM rls_test.users u
       WHERE u.id = $1`,
      [user1.id]
    );

    expect(result.length).toBe(1);
    expect(Number(result[0].product_count)).toBe(1);
    expect(Number(result[0].total_value)).toBe(100.00);
  });

  it('should handle context switching between multiple users in same test', async () => {
    // create two users as admin
    const user1 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['complex6@example.com', 'Complex User 6']
    );

    const user2 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['complex7@example.com', 'Complex User 7']
    );

    // create products for both users
    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User1 Product', 'User1 owns', 100.00, user1.id]
    );

    await pg.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User2 Product', 'User2 owns', 200.00, user2.id]
    );

    // switch to user1 context
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user1.id
    });

    const user1Products = await db.many(
      `SELECT name, price FROM rls_test.products WHERE owner_id = $1`,
      [user1.id]
    );
    expect(user1Products.length).toBe(1);
    expect(user1Products[0].name).toBe('User1 Product');

    // switch to user2 context
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user2.id
    });

    const user2Products = await db.many(
      `SELECT name, price FROM rls_test.products WHERE owner_id = $1`,
      [user2.id]
    );
    expect(user2Products.length).toBe(1);
    expect(user2Products[0].name).toBe('User2 Product');
  });

  it('should verify auth.uid() and auth.role() functions work correctly', async () => {
    // create user as admin
    const user = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['complex8@example.com', 'Complex User 8']
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user.id
    });

    // verify auth.uid() returns correct user id
    const uidResult = await db.one(`SELECT auth.uid() as uid`);
    expect(uidResult.uid).toBe(user.id);

    // verify auth.role() returns correct role
    const roleResult = await db.one(`SELECT auth.role() as role`);
    expect(roleResult.role).toBe('authenticated');

    // verify these work in product queries
    const products = await db.any(
      `SELECT 
         p.name,
         auth.uid() as current_user_id,
         auth.role() as current_role
       FROM rls_test.products p
       WHERE p.owner_id = auth.uid()`
    );

    // should be empty since no products exist yet, but query should work
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBe(0);
  });
});

