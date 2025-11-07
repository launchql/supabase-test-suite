import { getConnections, PgTestClient, seed } from 'supabase-test';
import path from 'path';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

const sql = (f: string) => path.join(__dirname, 'data', f);

const cwd = path.resolve(__dirname, '../../');

beforeAll(async () => {
  ({ pg, db, teardown } = await getConnections(
    {}, [
      seed.launchql(cwd),
      seed.sqlfile([
        sql('seed-data.sql'),
      ])    ]
  ));
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

describe('tutorial: testing with sql file seeding', () => {
  it('should work with sql file seed function', async () => {

    db.setContext({ role: 'service_role' });

    const user = await db.one(
      `INSERT INTO rls_test.users (email, name) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['sql-seed1@example.com', 'SQL Seed User 1']
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
      `SELECT id FROM rls_test.users WHERE id = $1`,
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
      `SELECT id FROM rls_test.users WHERE id = $1`,
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

