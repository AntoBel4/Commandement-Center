import pg from 'pg';
import { pathToFileURL } from 'node:url';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function bootstrapFamily({ databaseUrl, familyId, familyName, userIds }) {
  familyId = typeof familyId === 'string' ? familyId.toLowerCase() : familyId;
  userIds = Array.isArray(userIds) ? userIds.map((id) => typeof id === 'string' ? id.toLowerCase() : id) : userIds;
  if (!databaseUrl || !uuid.test(familyId) || !familyName?.trim() || familyName.length > 100 ||
      !Array.isArray(userIds) || userIds.length !== 2 || new Set(userIds).size !== 2 ||
      !userIds.every((id) => uuid.test(id))) {
    throw new Error('DATABASE_URL, FAMILY_ID, FAMILY_NAME and two distinct KEYCLOAK_USER_IDS (UUIDs) are required');
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [familyId]);
    const existing = await client.query('select user_id from family_members where family_id=$1', [familyId]);
    if (existing.rows.some((row) => !userIds.includes(row.user_id))) {
      throw new Error('Existing membership differs; reconcile explicitly before provisioning');
    }
    await client.query('insert into families (id, name) values ($1,$2) on conflict (id) do nothing',
      [familyId, familyName.trim()]);
    for (const [index, userId] of userIds.entries()) {
      await client.query(`insert into family_members (family_id,user_id,role) values ($1,$2,$3)
        on conflict (family_id,user_id) do nothing`, [familyId, userId, index === 0 ? 'owner' : 'member']);
    }
    await client.query('commit');
    return { familyId, members: 2 };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await bootstrapFamily({
    databaseUrl: process.env.DATABASE_URL, familyId: process.env.FAMILY_ID,
    familyName: process.env.FAMILY_NAME,
    userIds: (process.env.KEYCLOAK_USER_IDS || '').split(',').map((id) => id.trim())
  });
  console.log(JSON.stringify(result));
}
