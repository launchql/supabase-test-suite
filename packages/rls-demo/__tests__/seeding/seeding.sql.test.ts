import { getConnections, PgTestClient, seed } from 'supabase-test';
import path from 'path';

let db: PgTestClient;
let teardown: () => Promise<void>;

const sql = (f: string) => path.join(__dirname, 'data', f);

const cwd = path.resolve(__dirname, '../../');

beforeAll(async () => {
  ({ db, teardown } = await getConnections(
    {}, [
    seed.launchql(cwd),
    seed.sqlfile([
      sql('seed-data.sql'),
    ])
  ]
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

const users = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'tutorial1@example.com',
    name: 'Tutorial User 1'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'tutorial2@example.com',
    name: 'Tutorial User 2'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'tutorial3@example.com',
    name: 'Tutorial User 3'
  }
];

describe('tutorial: testing with sql file seeding', () => {
  it('should work with sql file seed function', async () => {

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': users[0].id
    });

    const verifiedPets = await db.any(
      `SELECT id FROM rls_test.pets WHERE user_id = $1`,
      [users[0].id]
    );
    expect(verifiedPets.length).toBe(1);

    db.clearContext();

    const anonPets = await db.any(
      `SELECT id FROM rls_test.pets WHERE user_id = $1`,
      [users[0].id]
    );
    expect(anonPets.length).toBe(0);

  });

});

