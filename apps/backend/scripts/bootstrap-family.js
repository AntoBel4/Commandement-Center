import pg from 'pg';

const { Pool } = pg;
const familyName = process.env.FAMILY_NAME?.trim();
const userId = process.env.KEYCLOAK_USER_ID?.trim();
const databaseUrl = process.env.DATABASE_URL;

if (!familyName || !userId || !databaseUrl) {
  throw new Error('FAMILY_NAME, KEYCLOAK_USER_ID and DATABASE_URL are required');
}

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
  throw new Error('KEYCLOAK_USER_ID must be a UUID');
}

const pool = new Pool({ connectionString: databaseUrl });
try {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const family = await client.query(
      'insert into families (name) values ($1) returning id, name',
      [familyName]
    );
    await client.query(
      `insert into family_members (family_id, user_id, role)
       values ($1, $2, 'owner')`,
      [family.rows[0].id, userId]
    );
    await client.query('commit');
    console.log(JSON.stringify({ family: family.rows[0], userId, role: 'owner' }, null, 2));
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
