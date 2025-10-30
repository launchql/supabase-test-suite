import { getConnections, PgTestClient } from 'pgsql-test';

let db: PgTestClient;
let pg: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ db, pg, teardown } = await getConnections());
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

const user_id_1 = '550e8400-e29b-41d4-a716-446655440001';
const user_id_2 = '550e8400-e29b-41d4-a716-446655440002';

describe('RLS Demo - Data Insertion', () => {
  it('should insert users and products', async () => {

    // Insert users
    await db.any(
      `INSERT INTO rls_test.users (id, email, name) 
       VALUES ($1, $2, $3)`,
      [user_id_1, 'alice@example.com', 'Alice Johnson']
    );

    await db.any(
      `INSERT INTO rls_test.users (id, email, name) 
       VALUES ($1, $2, $3)`,
      [user_id_2, 'bob@example.com', 'Bob Smith']
    );

    // Insert products
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user_id_1
    });

    const product1 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, price, owner_id`,
      ['Laptop Pro', 'High-performance laptop', 1299.99, user_id_1]
    );

    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': user_id_2
    });

    const product2 = await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, price, owner_id`,
      ['Wireless Mouse', 'Ergonomic mouse', 49.99, user_id_2]
    );

    expect(product1.name).toBe('Laptop Pro');
    expect(product1.owner_id).toEqual(user_id_1);
    expect(product2.owner_id).toEqual(user_id_2);
    expect(product2.name).toBe('Wireless Mouse');
  });

  it('should rollback to initial state', async () => {
    db.setContext({
      role: 'service_role'
    });

    const result = await db.any(
      `SELECT u.name, p.name as product_name, p.price
       FROM rls_test.users u
       JOIN rls_test.products p ON u.id = p.owner_id
       ORDER BY u.name, p.name`
    );
    expect(result.length).toEqual(0);
  });
});
