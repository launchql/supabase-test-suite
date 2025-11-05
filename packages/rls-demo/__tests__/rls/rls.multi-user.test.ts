import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  // use existing supabase database connection
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

describe('tutorial: multi-user rls enforcement', () => {
  it('should prevent user from reading another user\'s data', async () => {
    db.setContext({ role: 'service_role' });

    // create two users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['alice@example.com', 'Alice']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['bob@example.com', 'Bob']
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 can see their own data
    const ownData = await db.one(
      `SELECT id, email FROM rls_test.users WHERE id = $1`,
      [user1.id]
    );
    expect(ownData.id).toBe(user1.id);

    // user1 cannot see user2's data
    await expect(
      db.one(`SELECT id, email FROM rls_test.users WHERE id = $1`, [user2.id])
    ).rejects.toThrow();
  });

  it('should prevent user from reading another user\'s products', async () => {
    db.setContext({ role: 'service_role' });

    // create two users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['charlie@example.com', 'Charlie']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['diana@example.com', 'Diana']
    );

    // create products for each user
    // set service_role context for product inserts (rls_test.products needs service_role to bypass rls)
    db.setContext({ role: 'service_role' });
    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Charlie\'s Product', 'Charlie owns this', 100.00, user1.id]
    );

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Diana\'s Product', 'Diana owns this', 200.00, user2.id]
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 can see their own products
    const ownProducts = await db.many(
      `SELECT id, name FROM rls_test.products WHERE owner_id = $1`,
      [user1.id]
    );
    expect(ownProducts.length).toBe(1);
    expect(ownProducts[0].name).toBe('Charlie\'s Product');

    // user1 cannot see user2's products
    const otherProducts = await db.any(
      `SELECT id, name FROM rls_test.products WHERE owner_id = $1`,
      [user2.id]
    );
    expect(otherProducts.length).toBe(0);
  });

  it('should prevent user from updating another user\'s data', async () => {
    db.setContext({ role: 'service_role' });

    // create two users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['eve@example.com', 'Eve']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['frank@example.com', 'Frank']
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 can update their own data
    await db.any(
      `UPDATE rls_test.users SET name = $1 WHERE id = $2`,
      ['Eve Updated', user1.id]
    );

    // user1 cannot update user2's data - rls blocks it, affecting 0 rows
    const updateResult = await db.any(
      `UPDATE rls_test.users SET name = $1 WHERE id = $2`,
      ['Hacked Name', user2.id]
    );
    expect(updateResult.length).toBe(0);
  });

  it('should prevent user from updating another user\'s products', async () => {
    db.setContext({ role: 'service_role' });

    // create two users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['grace@example.com', 'Grace']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['henry@example.com', 'Henry']
    );

    // create products for each user
    // set service_role context for product inserts (rls_test.products needs service_role to bypass rls)
    db.setContext({ role: 'service_role' });
    const product1 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Grace\'s Product', 'Grace owns this', 100.00, user1.id]
    );

    const product2 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Henry\'s Product', 'Henry owns this', 200.00, user2.id]
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 can update their own product
    await db.any(
      `UPDATE rls_test.products SET price = $1 WHERE id = $2`,
      [150.00, product1.id]
    );

    // user1 cannot update user2's product - rls blocks it, affecting 0 rows
    const updateResult = await db.any(
      `UPDATE rls_test.products SET price = $1 WHERE id = $2`,
      [999.99, product2.id]
    );
    expect(updateResult.length).toBe(0);
  });

  it('should prevent user from deleting another user\'s products', async () => {
    // create two users as admin
    db.setContext({ role: 'service_role' });
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['iris@example.com', 'Iris']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['jack@example.com', 'Jack']
    );

    // create products for each user
    // set service_role context for product inserts (rls_test.products needs service_role to bypass rls)
    db.setContext({ role: 'service_role' });
    const product1 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Iris\'s Product', 'Iris owns this', 100.00, user1.id]
    );

    const product2 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Jack\'s Product', 'Jack owns this', 200.00, user2.id]
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 can delete their own product
    await db.any(
      `DELETE FROM rls_test.products WHERE id = $1`,
      [product1.id]
    );

    // user1 cannot delete user2's product - rls blocks it, affecting 0 rows
    const deleteResult = await db.any(
      `DELETE FROM rls_test.products WHERE id = $1`,
      [product2.id]
    );
    expect(deleteResult.length).toBe(0);
  });

  it('should prevent user from creating products for another user', async () => {
    db.setContext({ role: 'service_role' });
    // create two users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['karen@example.com', 'Karen']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['larry@example.com', 'Larry']
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 can create product for themselves
    const ownProduct = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, owner_id`,
      ['Karen\'s Product', 'Karen owns this', 100.00, user1.id]
    );
    expect(ownProduct.owner_id).toBe(user1.id);

    // user1 cannot create product for user2
    await expect(
      db.one(
        `INSERT INTO rls_test.products (name, description, price, owner_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ['Larry\'s Product', 'Larry should own this', 200.00, user2.id]
      )
    ).rejects.toThrow();
  });

  it('should allow users to see only their own data in list queries', async () => {
    db.setContext({role: 'service_role'});
    // create multiple users as admin
    const user1 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['mary@example.com', 'Mary']
    );

    const user2 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['nancy@example.com', 'Nancy']
    );

    const user3 = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['oliver@example.com', 'Oliver']
    );

    // set context to user1
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id
    });

    // user1 should only see their own record in a list query
    const allUsers = await db.many(
      `SELECT id, email, name FROM rls_test.users ORDER BY email`
    );

    expect(allUsers.length).toBe(1);
    expect(allUsers[0].id).toBe(user1.id);
    expect(allUsers[0].email).toBe('mary@example.com');
  });
});

