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

describe('tutorial: basic rls crud operations', () => {
  it('should allow user to create their own user record', async () => {
    db.setContext({ role: 'service_role' });

    // create user as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name`,
      ['tutorial1@example.com', 'Tutorial User 1']
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // verify user can see their own record
    const ownRecord = await db.one(
      `SELECT id, email, name FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );

    expect(ownRecord.id).toBe(user.id);
    expect(ownRecord.email).toBe('tutorial1@example.com');
    expect(ownRecord.name).toBe('Tutorial User 1');
  });

  it('should allow user to create their own products', async () => {
    db.setContext({ role: 'service_role' });

    // create user as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['tutorial2@example.com', 'Tutorial User 2']
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user can create their own product
    const product = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, price, owner_id`,
      ['Tutorial Product', 'A product for tutorial', 99.99, user.id]
    );

    expect(product.name).toBe('Tutorial Product');
    expect(product.owner_id).toBe(user.id);
    expect(Number(product.price)).toBe(99.99);
  });

  it('should allow user to read their own products', async () => {
    db.setContext({ role: 'service_role' });

    // create user and product as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['tutorial3@example.com', 'Tutorial User 3']
    );

    // set service_role context for product inserts (rls_test.products needs service_role to bypass rls)
    db.setContext({ role: 'service_role' });
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
      ['Product B', 'Description B', 75.00, user.id]
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user can read their own products
    const products = await db.many(
      `SELECT id, name, price FROM rls_test.products WHERE owner_id = $1`,
      [user.id]
    );

    expect(products.length).toBe(2);
    expect(products[0].name).toBe('Product A');
    expect(products[1].name).toBe('Product B');
  });

  it('should allow user to update their own user record', async () => {
    db.setContext({ role: 'service_role' });
    // create user as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['tutorial4@example.com', 'Tutorial User 4']
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user can update their own record
    const updated = await db.one(
      `UPDATE rls_test.user_profiles 
       SET name = $1 
       WHERE id = $2 
       RETURNING id, name, updated_at`,
      ['Updated Name', user.id]
    );

    expect(updated.name).toBe('Updated Name');
    expect(updated.id).toBe(user.id);
    expect(updated.updated_at).toBeDefined();
  });

  it('should allow user to update their own products', async () => {
    // create user and product as admin
    db.setContext({ role: 'service_role' });
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['tutorial5@example.com', 'Tutorial User 5']
    );

    // set service_role context for product insert (rls_test.products needs service_role to bypass rls)
    const product = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Original Product', 'Original Description', 100.00, user.id]
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user can update their own product
    const updated = await db.one(
      `UPDATE rls_test.products 
       SET name = $1, price = $2 
       WHERE id = $3 
       RETURNING id, name, price`,
      ['Updated Product', 150.00, product.id]
    );

    expect(updated.name).toBe('Updated Product');
    expect(Number(updated.price)).toBe(150.00);
  });

  it('should allow user to delete their own products', async () => {
    db.setContext({ role: 'service_role' });
    // create user and products as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['tutorial6@example.com', 'Tutorial User 6']
    );

    // set service_role context for product inserts (rls_test.products needs service_role to bypass rls)
    db.setContext({ role: 'service_role' });
    const product1 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product To Delete', 'Will be deleted', 50.00, user.id]
    );

    const product2 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Product To Keep', 'Will remain', 75.00, user.id]
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user can delete their own product
    await db.any(
      `DELETE FROM rls_test.products WHERE id = $1`,
      [product1.id]
    );

    // verify only one product remains
    const remaining = await db.many(
      `SELECT id, name FROM rls_test.products WHERE owner_id = $1`,
      [user.id]
    );

    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(product2.id);
    expect(remaining[0].name).toBe('Product To Keep');
  });

  it('should allow user to delete their own user record', async () => {
    db.setContext({ role: 'service_role' });
    // create user as admin
    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['tutorial7@example.com', 'Tutorial User 7']
    );

    // set context to simulate authenticated user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    // user can delete their own record
    await db.any(
      `DELETE FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );

    // verify record is gone
    const result = await db.any(
      `SELECT id FROM rls_test.user_profiles WHERE id = $1`,
      [user.id]
    );

    expect(result.length).toBe(0);
  });
});

