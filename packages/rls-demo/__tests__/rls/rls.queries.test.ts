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

describe('tutorial: advanced query patterns with rls', () => {
  it('should handle pagination correctly with rls', async () => {
    db.setContext({ role: 'service_role' });

    // create user as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['pagination1@example.com', 'Pagination User 1']
    );

    // create many products for user
    db.setContext({
      role: 'service_role'
    });

    for (let i = 1; i <= 15; i++) {
      await db.any(
        `INSERT INTO rls_test.products (name, description, price, owner_id) 
         VALUES ($1, $2, $3, $4)`,
        [`Product ${i}`, `Description ${i}`, i * 10.00, user.id]
      );
    }

    // set context to user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // first page
    const page1 = await db.many(
      `SELECT id, name, price 
       FROM rls_test.products 
       ORDER BY price 
       LIMIT 10 OFFSET 0`
    );
    expect(page1.length).toBe(10);
    expect(Number(page1[0].price)).toBe(10.00);
    expect(Number(page1[9].price)).toBe(100.00);

    // second page
    const page2 = await db.many(
      `SELECT id, name, price 
       FROM rls_test.products 
       ORDER BY price 
       LIMIT 10 OFFSET 10`
    );
    expect(page2.length).toBe(5);
    expect(Number(page2[0].price)).toBe(110.00);
    expect(Number(page2[4].price)).toBe(150.00);
  });

  it('should filter correctly with case-insensitive search and rls', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['search1@example.com', 'Search User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Apple iPhone', 'Mobile phone', 999.99, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Samsung Galaxy', 'Android phone', 899.99, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Apple MacBook', 'Laptop computer', 1299.99, user.id]);

    // search for apple products (case insensitive)
    const appleProducts = await db.many(
      `SELECT name, price 
       FROM rls_test.products 
       WHERE LOWER(name) LIKE LOWER($1)
       ORDER BY price`,
      ['%apple%']
    );

    expect(appleProducts.length).toBe(2);
    expect(appleProducts[0].name).toBe('Apple iPhone');
    expect(appleProducts[1].name).toBe('Apple MacBook');
  });

  it('should respect rls when using window functions', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['window1@example.com', 'Window User 1']
    );

    db.setContext({
      role: 'service_role'
    });

    // create products with varying prices
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Product A', 'Cheap', 10.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Product B', 'Mid', 50.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Product C', 'Expensive', 100.00, user.id]);

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // use window function to rank products
    const ranked = await db.many(
      `SELECT 
         name,
         price,
         ROW_NUMBER() OVER (ORDER BY price) as rank,
         AVG(price) OVER () as avg_price
       FROM rls_test.products
       ORDER BY price`
    );

    expect(ranked.length).toBe(3);
    expect(Number(ranked[0].rank)).toBe(1);
    expect(ranked[0].name).toBe('Product A');
    expect(Number(ranked[0].avg_price)).toBeCloseTo(53.33, 2);
  });

  it('should handle batch inserts correctly with rls', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['batch1@example.com', 'Batch User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // batch insert using VALUES clause with explicit parameters
    await db.any(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES 
         ($1, $2, $3, $4),
         ($5, $6, $7, $8),
         ($9, $10, $11, $12)`,
      [
        'Batch Product 1', 'Description 1', 10.00, user.id,
        'Batch Product 2', 'Description 2', 20.00, user.id,
        'Batch Product 3', 'Description 3', 30.00, user.id
      ]
    );

    const products = await db.many(
      `SELECT name, price FROM rls_test.products WHERE owner_id = $1 ORDER BY price`,
      [user.id]
    );

    expect(products.length).toBe(3);
    expect(products[0].name).toBe('Batch Product 1');
    expect(products[1].name).toBe('Batch Product 2');
    expect(products[2].name).toBe('Batch Product 3');
  });

  it('should respect rls when using common table expressions', async () => {
    db.setContext({ role: 'service_role' });

    const user1 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['cte1@example.com', 'CTE User 1']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['cte2@example.com', 'CTE User 2']
    );

    db.setContext({
      role: 'service_role'
    });

    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['User1 Product', 'User1', 100.00, user1.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['User1 Product 2', 'User1', 200.00, user1.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['User2 Product', 'User2', 300.00, user2.id]);

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // use cte to calculate totals
    const result = await db.one(
      `WITH user_products AS (
         SELECT name, price FROM rls_test.products
       ),
       totals AS (
         SELECT 
           COUNT(*) as count,
           SUM(price) as total
         FROM user_products
       )
       SELECT * FROM totals`
    );

    // rls should filter to only user1's products
    expect(Number(result.count)).toBe(2);
    expect(Number(result.total)).toBe(300.00);
  });

  it('should handle date range filtering with rls', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['date1@example.com', 'Date User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // insert products at different times
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id, created_at) 
                  VALUES ($1, $2, $3, $4, NOW() - INTERVAL '2 days')`,
                  ['Old Product', 'Two days ago', 100.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id, created_at) 
                  VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 day')`,
                  ['Recent Product', 'One day ago', 200.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id, created_at) 
                  VALUES ($1, $2, $3, $4, NOW())`,
                  ['Today Product', 'Today', 300.00, user.id]);

    // filter products created in last 24 hours
    const recent = await db.many(
      `SELECT name, price, created_at 
       FROM rls_test.products 
       WHERE created_at >= NOW() - INTERVAL '1 day'
       ORDER BY created_at`
    );

    expect(recent.length).toBe(2);
    expect(recent[0].name).toBe('Recent Product');
    expect(recent[1].name).toBe('Today Product');
  });

  it('should handle ordering by multiple columns with rls', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['order1@example.com', 'Order User 1']
    );

    db.setContext({
      role: 'service_role'
    });

    // create products with same price but different names
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Zebra Product', 'Z', 100.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Apple Product', 'A', 100.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Banana Product', 'B', 100.00, user.id]);

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // order by price desc, then name asc
    const ordered = await db.many(
      `SELECT name, price 
       FROM rls_test.products 
       ORDER BY price DESC, name ASC`
    );

    expect(ordered.length).toBe(3);
    expect(ordered[0].name).toBe('Apple Product');
    expect(ordered[1].name).toBe('Banana Product');
    expect(ordered[2].name).toBe('Zebra Product');
  });

  it('should handle group by aggregations with rls', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['group1@example.com', 'Group User 1']
    );

    db.setContext({
      role: 'service_role'
    });

    // create products in different price ranges
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Cheap 1', 'Under 50', 10.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Cheap 2', 'Under 50', 20.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Mid 1', '50-100', 75.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Expensive 1', 'Over 100', 150.00, user.id]);

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // group by price range
    const grouped = await db.many(
      `SELECT 
         CASE 
           WHEN price < 50 THEN 'cheap'
           WHEN price < 100 THEN 'mid'
           ELSE 'expensive'
         END as price_range,
         COUNT(*) as count,
         AVG(price) as avg_price
       FROM rls_test.products
       GROUP BY price_range
       ORDER BY avg_price`
    );

    expect(grouped.length).toBe(3);
    expect(grouped[0].price_range).toBe('cheap');
    expect(Number(grouped[0].count)).toBe(2);
    expect(grouped[1].price_range).toBe('mid');
    expect(Number(grouped[1].count)).toBe(1);
    expect(grouped[2].price_range).toBe('expensive');
    expect(Number(grouped[2].count)).toBe(1);
  });

  it('should handle having clause with rls', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['having1@example.com', 'Having User 1']
    );

    db.setContext({
      role: 'service_role'
    });

    // create products with different prices
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Product A', 'Description', 10.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Product B', 'Description', 21.00, user.id]);
    await db.any(`INSERT INTO rls_test.products (name, description, price, owner_id) 
                  VALUES ($1, $2, $3, $4)`,
                  ['Product C', 'Description', 30.00, user.id]);

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // find price ranges with average > 15
    const filtered = await db.many(
      `SELECT 
         CASE 
           WHEN price < 25 THEN 'low'
           ELSE 'high'
         END as range,
         AVG(price) as avg_price
       FROM rls_test.products
       GROUP BY range
       HAVING AVG(price) > 15
       ORDER BY avg_price`
    );

    expect(filtered.length).toBe(2);
    expect(filtered[0].range).toBe('low');
    expect(filtered[1].range).toBe('high');
    
  });
});

