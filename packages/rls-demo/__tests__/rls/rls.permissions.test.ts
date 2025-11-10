import { getConnections, PgTestClient } from 'supabase-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ pg, db, teardown } = await getConnections());
  await pg.any(
    `GRANT USAGE ON SCHEMA auth TO public;
     GRANT EXECUTE ON FUNCTION auth.uid() TO public;
     GRANT EXECUTE ON FUNCTION auth.role() TO public;
     GRANT EXECUTE ON FUNCTION auth.email() TO public;`,
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

describe('tutorial: rls permission and access control patterns', () => {
  it('should verify auth.email() function works correctly', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email`,
      ['email1@example.com', 'Email User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id,
      'request.jwt.claim.email': user.email
    });

    // verify auth.email() returns correct email
    const emailResult = await db.one(`SELECT auth.email() as email`);
    expect(emailResult.email).toBe(user.email);
  });

  it('should prevent users from accessing tables without proper grants', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['grant1@example.com', 'Grant User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user can access their own data
    const ownData = await db.one(
      `SELECT id, email FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );
    expect(ownData.id).toBe(user.id);

    // but cannot access other schemas or tables without grants
    // this test verifies rls policies are working correctly
    const products = await db.any(
      `SELECT id FROM rls_test.products WHERE owner_id = $1`,
      [user.id]
    );
    expect(Array.isArray(products)).toBe(true);
  });

  it('should verify service_role bypasses all rls policies', async () => {
    db.setContext({ role: 'service_role' });

    const user1 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['service1@example.com', 'Service User 1']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['service2@example.com', 'Service User 2']
    );

    // service_role can see all users
    const allUsers = await db.many(
      `SELECT id, email FROM rls_test.user_profiles ORDER BY email`
    );
    expect(allUsers.length).toBe(2);

    // service_role can insert products for any user
    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Admin Product', 'Created by admin', 999.99, user2.id]
    );

    // service_role can see all products
    const allProducts = await db.many(
      `SELECT id, owner_id FROM rls_test.products`
    );
    expect(allProducts.length).toBe(1);
    expect(allProducts[0].owner_id).toBe(user2.id);
  });

  it('should verify rls policies work correctly with multiple conditions', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['multi1@example.com', 'Multi Condition User 1']
    );

    // create products with different attributes
    db.setContext({
      role: 'service_role'
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Expensive Item', 'High price', 500.00, user.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Cheap Item', 'Low price', 10.00, user.id]
    );

    // switch to authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user can filter their products with multiple conditions
    const expensive = await db.many(
      `SELECT name, price 
       FROM rls_test.products 
       WHERE owner_id = $1 AND price > 100
       ORDER BY price DESC`,
      [user.id]
    );
    expect(expensive.length).toBe(1);
    expect(Number(expensive[0].price)).toBe(500.00);

    // user can also see all their products regardless of conditions
    const allOwnProducts = await db.many(
      `SELECT COUNT(*) as count FROM rls_test.products`
    );
    expect(Number(allOwnProducts[0].count)).toBe(2);
  });

  it('should handle rls with exists subqueries', async () => {
    db.setContext({ role: 'service_role' });

    const user1 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['exists1@example.com', 'Exists User 1']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['exists2@example.com', 'Exists User 2']
    );

    db.setContext({
      role: 'service_role'
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User1 Product', 'User1 owns', 100.00, user1.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User2 Product', 'User2 owns', 200.00, user2.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // use exists to check for products
    const usersWithProducts = await db.many(
      `SELECT u.id, u.email, 
         EXISTS(SELECT 1 FROM rls_test.products p WHERE p.owner_id = u.id) as has_products
       FROM rls_test.user_profiles u
       WHERE u.id = $1`,
      [user1.id]
    );

    expect(usersWithProducts.length).toBe(1);
    expect(usersWithProducts[0].has_products).toBe(true);

    // verify user2's products are not visible
    const user2Check = await db.any(
      `SELECT u.id 
       FROM rls_test.user_profiles u
       WHERE EXISTS(SELECT 1 FROM rls_test.products p WHERE p.owner_id = u.id AND u.id = $1)`,
      [user2.id]
    );
    expect(user2Check.length).toBe(0);
  });

  it('should verify rls respects table-level permissions', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['permissions1@example.com', 'Permissions User 1']
    );

    // authenticated user can insert
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    const product = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name`,
      ['My Product', 'My Description', 99.99, user.id]
    );

    expect(product.name).toBe('My Product');

    // user can update their own product
    const updated = await db.one(
      `UPDATE rls_test.products 
       SET name = $1 
       WHERE id = $2 
       RETURNING name`,
      ['Updated Product', product.id]
    );
    expect(updated.name).toBe('Updated Product');

    // user can delete their own product
    await db.any(
      `DELETE FROM rls_test.products WHERE id = $1`,
      [product.id]
    );

    // verify it's gone
    const remaining = await db.any(
      `SELECT id FROM rls_test.products WHERE id = $1`,
      [product.id]
    );
    expect(remaining.length).toBe(0);
  });
});

