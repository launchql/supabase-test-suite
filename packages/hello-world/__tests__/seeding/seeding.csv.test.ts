import path from 'path';
import { getConnections, PgTestClient, seed } from 'supabase-test';
import { users } from './data/seed-data';

// pg is used to have RLS bypass (required to insert into supabase auth.users)
let db: PgTestClient;
// db is used to test the RLS policies in test cases
let pg: PgTestClient;
let teardown: () => Promise<void>;

const csv = (file: string) => path.resolve(__dirname, './data', file);

beforeAll(async () => {
  ({ pg, db, teardown } = await getConnections());

  await pg.loadCsv({
    'auth.users': csv('users.csv'),
    'rls_test.pets': csv('pets.csv')
  });

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

describe('csv seeding', () => {
  it('has loaded rows from csv files', async () => {
    const usersRes = await pg.query('SELECT COUNT(*) FROM auth.users');
    expect(+usersRes.rows[0].count).toBeGreaterThan(0);

    const petsRes = await pg.query('SELECT COUNT(*) FROM rls_test.pets');
    expect(+petsRes.rows[0].count).toBeGreaterThan(0);

    // verify specific data was loaded
    const alice = await pg.one(
      `SELECT * FROM rls_test.pets WHERE user_id = $1`,
      [users[0].id]
    );
    expect(alice.name).toBe('Fido');

    const alicePets = await pg.query(
      `SELECT COUNT(*) FROM rls_test.pets WHERE user_id = $1`,
      [users[0].id]
    );
    expect(+alicePets.rows[0].count).toBe(1);
  });

  it('should enforce RLS - users can only see their own pets', async () => {
    // set context to first user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': users[0].id
    });

    // user1 should only see their own pet (Fido)
    const user1Pets = await db.many(
      `SELECT id, name, breed, user_id FROM rls_test.pets ORDER BY name`
    );

    expect(user1Pets.length).toBe(1);
    expect(user1Pets[0].user_id).toBe(users[0].id);
    expect(user1Pets[0].name).toBe('Fido');

    // set context to second user
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': users[1].id
    });

    // user2 should only see their own pet (Buddy)
    const user2Pets = await db.many(
      `SELECT id, name, breed, user_id FROM rls_test.pets ORDER BY name`
    );

    expect(user2Pets.length).toBe(1);
    expect(user2Pets[0].user_id).toBe(users[1].id);
    expect(user2Pets[0].name).toBe('Buddy');
  });
});

