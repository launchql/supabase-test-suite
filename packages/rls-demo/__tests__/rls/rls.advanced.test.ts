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

describe('tutorial: advanced rls edge cases and scenarios', () => {
  it('should prevent anon users from accessing any data', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced1@example.com', 'Advanced User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Secret Product', 'Should not be visible', 100.00, user.id]
    );

    const verifiedUsers = await db.any(
      `SELECT id FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );
    expect(verifiedUsers.length).toBe(1);

    const verifiedProducts = await db.any(
      `SELECT id FROM rls_test.products WHERE owner_id = $1`,
      [user.id]
    );
    expect(verifiedProducts.length).toBe(1);

    db.clearContext();
    
    const anonUsers = await db.any(
      `SELECT id FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );
    expect(anonUsers.length).toBe(0);

    const anonProducts = await db.any(
      `SELECT id FROM rls_test.products WHERE owner_id = $1`,
      [user.id]
    );
    expect(anonProducts.length).toBe(0);
  });

    
  it('should handle empty result sets correctly with rls', async () => {

    db.setContext({ role: 'service_role' });

    // create user as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced2@example.com', 'Advanced User 2']
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user has no products yet, query should return empty array
    const products = await db.any(
      `SELECT id, name FROM rls_test.products WHERE owner_id = $1`,
      [user.id]
    );

    expect(products.length).toBe(0);
    expect(Array.isArray(products)).toBe(true);
  });

  it('should handle updates that affect no rows due to rls', async () => {

    db.setContext({ role: 'service_role' });

    // create two users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced3@example.com', 'Advanced User 3']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced4@example.com', 'Advanced User 4']
    );

    // create product for user2
    db.setContext({
      role: 'service_role'
    });

    const product2 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User2 Product', 'User2 owns', 100.00, user2.id]
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 tries to update user2's product - should affect 0 rows
    const result = await db.any(
      `UPDATE rls_test.products 
       SET name = $1 
       WHERE id = $2
       RETURNING id`,
      ['Hacked Name', product2.id]
    );

    // rls prevents the update, so 0 rows affected
    expect(result.length).toBe(0);
  });

  it('should respect rls when counting all records', async () => {

    db.setContext({ role: 'service_role' });

    // create multiple users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced5@example.com', 'Advanced User 5']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced6@example.com', 'Advanced User 6']
    );

    // create products for both users
    db.setContext({
      role: 'service_role'
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User1 Product A', 'User1 owns', 100.00, user1.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User1 Product B', 'User1 owns', 200.00, user1.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User2 Product', 'User2 owns', 300.00, user2.id]
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 should only count their own products
    const count = await db.one(
      `SELECT COUNT(*) as count FROM rls_test.products`
    );

    expect(Number(count.count)).toBe(2); // only user1's products
  });

  it('should handle cascade deletes correctly with rls', async () => {

    db.setContext({ role: 'service_role' });

    // create user as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced7@example.com', 'Advanced User 7']
    );

    // create products for user
    db.setContext({
      role: 'service_role'
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product A', 'Description A', 100.00, user.id]
    );

    await db.any(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4)`,
      ['Product B', 'Description B', 200.00, user.id]
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user deletes themselves - products should cascade delete
    await db.any(
      `DELETE FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );

    // verify products are gone (using admin to check)
    const remainingProducts = await db.any(
      `SELECT id FROM rls_test.products WHERE owner_id = $1`,
      [user.id]
    );

    expect(remainingProducts.length).toBe(0);
  });

  it('should prevent user from seeing other users\' data even with broad queries', async () => {

    db.setContext({ role: 'service_role' });

    // create three users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced8@example.com', 'Advanced User 8']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced9@example.com', 'Advanced User 9']
    );

    const user3 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced10@example.com', 'Advanced User 10']
    );

    // create products for all users
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

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['User3 Product', 'User3 owns', 300.00, user3.id]
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 should only see their own products even with broad query
    const allProducts = await db.many(
      `SELECT id, name, owner_id FROM rls_test.products ORDER BY price`
    );

    expect(allProducts.length).toBe(1);
    expect(allProducts[0].owner_id).toBe(user1.id);
    expect(allProducts[0].name).toBe('User1 Product');
  });

  it('should verify rls works with null values in auth context', async () => {

    db.setContext({ role: 'service_role' });

    // create user as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced11@example.com', 'Advanced User 11']
    );

    // set context with null user_id (should prevent access)
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': null
    });

    // should not be able to access user data with null user_id
    await expect(
      db.one(`SELECT id FROM rls_test.user_profiles WHERE id = $1`, [user.id])
    ).rejects.toThrow();
  });

  it('should demonstrate transaction isolation with rls', async () => {

    db.setContext({ role: 'service_role' });

    // create two users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced12@example.com', 'Advanced User 12']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['advanced13@example.com', 'Advanced User 13']
    );

    // user1 creates a product in their context
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    const product1 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name`,
      ['User1 Product', 'User1 owns', 100.00, user1.id]
    );

    // switch to user2 context
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user2.id
    });

    // user2 cannot see user1's product
    const user2View = await db.any(
      `SELECT id, name FROM rls_test.products`
    );
    expect(user2View.length).toBe(0);

    // user2 creates their own product
    const product2 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name`,
      ['User2 Product', 'User2 owns', 200.00, user2.id]
    );

    // user2 can see their own product
    const user2ViewAfter = await db.many(
      `SELECT id, name FROM rls_test.products`
    );
    expect(user2ViewAfter.length).toBe(1);
    expect(user2ViewAfter[0].id).toBe(product2.id);
  });
});

