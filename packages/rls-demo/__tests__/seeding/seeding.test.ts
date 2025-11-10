import { getConnections, PgTestClient, seed } from 'supabase-test';

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

describe('tutorial: testing with seeded data', () => {
  it('should work with launchql seed function', async () => {
    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.user_profiles (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['seeding1@example.com', 'Seeding User 1']
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user.id
    });

    await db.one(
      `INSERT INTO rls_test.products (name, description, price, owner_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['Seeded Product', 'Product created with seeded schema', 100.00, user.id]
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
});

