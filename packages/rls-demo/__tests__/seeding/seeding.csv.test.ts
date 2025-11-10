import { getConnections, PgTestClient, seed } from 'supabase-test';
import path from 'path';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

const csv = (file: string) => path.resolve(__dirname, './data', file);
const cwd = path.resolve(__dirname, '../../');

beforeAll(async () => {
  ({ pg, db, teardown } = await getConnections(
    {},
    [
      // create schema
      seed.launchql(cwd),
      // load from csv
      seed.csv({
        'rls_test.users': csv('users.csv'),
        'rls_test.products': csv('products.csv')
      })
    ]
  ));
});

afterAll(async () => {
  await teardown();
});

// TODO: make issue for db/pg on csv seeding
// TODO: consider the supabase full schema 
describe('csv seeding', () => {
  it('has loaded rows from csv files', async () => {
    db.setContext({ role: 'service_role' });

    const usersRes = await pg.query('SELECT COUNT(*) FROM rls_test.users');
    console.log('usersRes', usersRes);
    expect(+usersRes.rows[0].count).toBeGreaterThan(0);

    const productsRes = await pg.query('SELECT COUNT(*) FROM rls_test.products');
    expect(+productsRes.rows[0].count).toBeGreaterThan(0);

    // verify specific data was loaded
    const alice = await pg.one(
      `SELECT * FROM rls_test.users WHERE email = $1`,
      ['alice@example.com']
    );
    expect(alice.name).toBe('Alice Johnson');

    const aliceProducts = await pg.query(
      `SELECT COUNT(*) FROM rls_test.products WHERE owner_id = $1`,
      [alice.id]
    );
    expect(+aliceProducts.rows[0].count).toBe(2);
  });
});

