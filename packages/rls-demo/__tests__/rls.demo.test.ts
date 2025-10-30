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

describe('RLS Demo - Data Insertion', () => {
  it('should insert users and products', async () => {
    // Insert users
    const user1 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['alice@example.com', 'Alice Johnson']
    );
    
    const user2 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['bob@example.com', 'Bob Smith']
    );

    // Insert products
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user1.id
    });

    const product1 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, price, owner_id`,
      ['Laptop Pro', 'High-performance laptop', 1299.99, user1.id]
    );
    
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user2.id
    });

    const product2 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, price, owner_id`,
      ['Wireless Mouse', 'Ergonomic mouse', 49.99, user2.id]
    );

    expect(user1.email).toBe('alice@example.com');
    expect(product1.name).toBe('Laptop Pro');
    expect(product1.owner_id).toEqual(user1.id);
    expect(product2.owner_id).toEqual(user2.id);
    expect(product2.name).toBe('Wireless Mouse');
  });


  it('should query user products with joins', async () => {
    // insert test data first
    const user1 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['charlie@example.com', 'Charlie Brown']
    );
    
    const user2 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['diana@example.com', 'Diana Prince']
    );

    // insert products
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user1.id
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, price, owner_id`,
      ['Gaming Keyboard', 'Mechanical gaming keyboard', 199.99, user1.id]
    );
    
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user2.id
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, price, owner_id`,
      ['Gaming Mouse', 'High DPI gaming mouse', 89.99, user2.id]
    );

    // now query the data
    const result = await db.many(
      `SELECT u.name, p.name as product_name, p.price
       FROM rls_test.users u
       JOIN rls_test.products p ON u.id = p.owner_id
       ORDER BY u.name, p.name`
    );
    
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('product_name');
  });

  it('should test RLS context switching', async () => {
    // insert test user first
    const user = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['eve@example.com', 'Eve Wilson']
    );
    
    // set context to simulate authenticated user with jwt claims
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user.id
    });

    // test auth.uid() function
    const uid = await db.one(`SELECT auth.uid() as uid`);
    expect(uid.uid).toBe(user.id);

    // test auth.role() function
    const role = await db.one(`SELECT auth.role() as role`);
    expect(role.role).toBe('authenticated');

    // query should work with rls policies
    const userData = await db.one(
      `SELECT id, email FROM rls_test.users WHERE id = $1`,
      [user.id]
    );
    
    expect(userData.id).toBe(user.id);
  });

  it('should fail RLS when trying to access other user\'s data', async () => {
    // insert two test users
    const user1 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['frank@example.com', 'Frank Miller']
    );
    
    const user2 = await pg.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['grace@example.com', 'Grace Lee']
    );
    
    // set context to user1
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user1.id
    });

    // this should work - user1 accessing their own data
    const ownData = await db.one(
      `SELECT id, email FROM rls_test.users WHERE id = $1`,
      [user1.id]
    );
    expect(ownData.id).toBe(user1.id);

    // this should fail - user1 trying to access user2's data
    await expect(
      db.one(`SELECT id, email FROM rls_test.users WHERE id = $1`, [user2.id])
    ).rejects.toThrow();

    // this should also fail - user1 trying to access user2's products
    await expect(
      db.one(`SELECT id, name FROM rls_test.products WHERE owner_id = $1`, [user2.id])
    ).rejects.toThrow();
  });

  it('should fail RLS when not authenticated', async () => {
    // Clear context to simulate unauthenticated user
    db.setContext({
      role: 'anon'
    });

    // These should all fail because we're not authenticated
    await expect(
      db.one(`SELECT id FROM rls_test.users LIMIT 1`)
    ).rejects.toThrow();

    await expect(
      db.one(`SELECT id FROM rls_test.products LIMIT 1`)
    ).rejects.toThrow();
  });
});
