import { getConnections, PgTestClient } from 'supabase-test';

let db: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ db, teardown } = await getConnections());
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

describe('tutorial: rls edge cases and error scenarios', () => {
  it('should handle missing user context gracefully', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['missing1@example.com', 'Missing Context User 1']
    );

    // switch to authenticated but don't set user id
    db.setContext({
      role: 'authenticated'
      // missing 'request.jwt.claim.sub'
    });

    // should not be able to access user data
    const result = await db.any(
      `SELECT id FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );
    expect(result.length).toBe(0);
  });

  it('should handle invalid uuid in context', async () => {
    // set context with invalid uuid format
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': 'not-a-uuid'
    });

    // operations should fail when auth.uid() tries to parse invalid uuid
    await expect(
      db.any(`SELECT id FROM rls_test.user_profiles`)
    ).rejects.toThrow();
  });

  it('should handle concurrent context switches correctly', async () => {
    db.setContext({ role: 'service_role' });

    const user1 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['concurrent1@example.com', 'Concurrent User 1']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['concurrent2@example.com', 'Concurrent User 2']
    );

    // create products for both
    db.setContext({
      role: 'service_role'
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User1 Product', 'User1', 100.00, user1.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User2 Product', 'User2', 200.00, user2.id]
    );

    // rapid context switches
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });
    const user1Products = await db.many(`SELECT COUNT(*) as count FROM rls_test.products`);
    expect(Number(user1Products[0].count)).toBe(1);

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user2.id
    });
    const user2Products = await db.many(`SELECT COUNT(*) as count FROM rls_test.products`);
    expect(Number(user2Products[0].count)).toBe(1);

    // switch back to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });
    const user1ProductsAgain = await db.many(`SELECT COUNT(*) as count FROM rls_test.products`);
    expect(Number(user1ProductsAgain[0].count)).toBe(1);
  });

  it('should handle empty string values in queries', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['empty1@example.com', 'Empty Value User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // create product with empty description
    const product = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, description`,
      ['Product', '', 50.00, user.id]
    );

    expect(product.description).toBe('');

    // can query products with empty description
    const products = await db.many(
      `SELECT name, description 
       FROM rls_test.products 
       WHERE owner_id = $1 AND description = $2`,
      [user.id, '']
    );
    expect(products.length).toBe(1);
  });

  it('should handle null values in context correctly', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['null1@example.com', 'Null Context User 1']
    );

    // set context with explicit null
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': null
    });

    // should not access user data
    const result = await db.any(
      `SELECT id FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );
    expect(result.length).toBe(0);
  });

  it('should handle large result sets with rls', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['large1@example.com', 'Large Result User 1']
    );

    db.setContext({
      role: 'service_role'
    });

    // create many products
    for (let i = 1; i <= 50; i++) {
      await db.any(
        `INSERT INTO rls_test.products (name, description, price, owner_id) 
         VALUES ($1, $2, $3, $4)`,
        [`Product ${i}`, `Description ${i}`, i * 5.00, user.id]
      );
    }

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // query all products - rls should filter correctly
    const allProducts = await db.many(
      `SELECT id, name, price 
       FROM rls_test.products 
       ORDER BY price`
    );

    expect(allProducts.length).toBe(50);
    expect(Number(allProducts[0].price)).toBe(5.00);
    expect(Number(allProducts[49].price)).toBe(250.00);
  });

  it('should handle transactions with multiple rls operations', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['transaction1@example.com', 'Transaction User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // perform multiple operations in sequence
    const product1 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product 1', 'First', 10.00, user.id]
    );

    const product2 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product 2', 'Second', 20.00, user.id]
    );

    // update first product
    await db.any(
      `UPDATE rls_test.products 
       SET price = $1 
       WHERE id = $2`,
      [15.00, product1.id]
    );

    // delete second product
    await db.any(
      `DELETE FROM rls_test.products WHERE id = $1`,
      [product2.id]
    );

    // verify final state
    const remaining = await db.many(
      `SELECT id, name, price FROM rls_test.products WHERE owner_id = $1`,
      [user.id]
    );
    expect(remaining.length).toBe(1);
    expect(Number(remaining[0].price)).toBe(15.00);
  });

  it('should handle complex nested queries with rls', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['nested1@example.com', 'Nested Query User 1']
    );

    db.setContext({
      role: 'service_role'
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product A', 'Description A', 100.00, user.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product B', 'Description B', 200.00, user.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // complex nested query
    const result = await db.one(
      `SELECT 
         u.name,
         (SELECT COUNT(*) 
          FROM rls_test.products p1 
          WHERE p1.owner_id = u.id) as total_products,
         (SELECT AVG(price) 
          FROM rls_test.products p2 
          WHERE p2.owner_id = u.id 
          AND p2.price > (SELECT MIN(price) FROM rls_test.products p3 WHERE p3.owner_id = u.id)) as avg_above_min
       FROM rls_test.user_profiles u
       WHERE u.id = $1`,
      [user.id]
    );

    expect(Number(result.total_products)).toBe(2);
    expect(Number(result.avg_above_min)).toBe(200.00);
  });

  it('should handle rls with union queries', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['union1@example.com', 'Union User 1']
    );

    db.setContext({
      role: 'service_role'
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Expensive Product', 'High price', 500.00, user.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Cheap Product', 'Low price', 10.00, user.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // union query - rls should apply to both parts
    const result = await db.many(
      `SELECT name, price, 'expensive' as category
       FROM rls_test.products
       WHERE price > 100
       UNION ALL
       SELECT name, price, 'cheap' as category
       FROM rls_test.products
       WHERE price <= 100
       ORDER BY price`
    );

    expect(result.length).toBe(2);
    expect(result[0].category).toBe('cheap');
    expect(result[1].category).toBe('expensive');
  });
});

