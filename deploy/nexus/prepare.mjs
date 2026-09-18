// Run once, on the deployment host. Never prints credentials or overwrites identity.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function configuration({ host, members, release, postgresImage, keycloakImage }) {
  if (!host || isIP(host) || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    throw new Error('PORTAL_HOST must be a DNS hostname without scheme or path');
  }
  if (!Array.isArray(members) || members.length !== 2 || new Set(members).size !== 2 ||
      !members.every(m => /^[a-z][a-z0-9._-]{1,39}$/.test(m))) throw new Error('Provide two distinct lower-case MEMBER_USERNAMES');
  if (!/^[a-f0-9]{7,40}$/.test(release || '')) throw new Error('RELEASE must identify the Git commit');
  for (const image of [postgresImage, keycloakImage]) {
    if (!/^[a-z0-9./:_-]+@sha256:[a-f0-9]{64}$/.test(image || '')) throw new Error('Both database and identity images must be pinned by digest');
  }
  const secret = () => randomBytes(32).toString('hex');
  const origin = 'https://' + host;
  const familyId = randomUUID();
  const users = members.map(username => ({ id: randomUUID(), username, enabled: true,
    requiredActions: ['UPDATE_PASSWORD'], credentials: [{type:'password', temporary:true, value:secret()}] }));
  return {
    env: { COMPOSE_PROJECT_NAME:'commandement', RELEASE:release, PORTAL_HOST:host,
      TRAEFIK_NETWORK:'proxy', TRAEFIK_CERT_RESOLVER:'cloudflare',
      POSTGRES_IMAGE:postgresImage, KEYCLOAK_IMAGE:keycloakImage,
      POSTGRES_PASSWORD:secret(), KEYCLOAK_DB_PASSWORD:secret(), KEYCLOAK_ADMIN_PASSWORD:secret(),
      FAMILY_ID:familyId, KEYCLOAK_USER_IDS:users.map(u=>u.id).join(',') },
    portal: {familyId,auth:{url:origin+'/auth',realm:'commandement',clientId:'commandement-center'}},
    users, origin
  };
}

export async function prepare(input, directory = new URL('../../.private/nexus/', import.meta.url)) {
  const data = configuration(input);
  data.env.DATABASE_URL = `postgresql://commandement:${data.env.POSTGRES_PASSWORD}@postgres:5432/commandement`;
  const realm = JSON.parse(await readFile(new URL('../keycloak/commandement-realm.json',import.meta.url),'utf8'));
  Object.assign(realm, {sslRequired:'all',resetPasswordAllowed:false,bruteForceProtected:true,
    failureFactor:5,permanentLockout:false,waitIncrementSeconds:60,maxFailureWaitSeconds:900,users:data.users});
  realm.clients[0].redirectUris = [data.origin+'/*'];
  realm.clients[0].webOrigins = [data.origin];
  // This application uses usernames only; email delivery is not configured yet.
  realm.registrationEmailAsUsername = false;
  const target = directory instanceof URL ? fileURLToPath(directory) : resolve(directory);
  await mkdir(resolve(target,'..'),{recursive:true,mode:0o700});
  await mkdir(target,{mode:0o700}); // EEXIST deliberately refuses credential rotation.
  const save = (name,content,mode=0o600) => writeFile(resolve(target,name),content,{flag:'wx',mode});
  await save('production.env',Object.entries(data.env).map(([k,v])=>k+'='+v).join('\n')+'\n');
  // Bind-mounted files must be readable by Keycloak/nginx container users. Parent stays 0700.
  await save('commandement-realm.json',JSON.stringify(realm,null,2)+'\n',0o644);
  await save('portal-config.json',JSON.stringify(data.portal,null,2)+'\n',0o644);
  await save('initial-access.json',JSON.stringify({users:data.users.map(u=>({username:u.username,
    temporaryPassword:u.credentials[0].value}))},null,2)+'\n');
  return target;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepare({host:process.env.PORTAL_HOST,members:process.env.MEMBER_USERNAMES?.split(','),
    release:process.env.RELEASE,postgresImage:process.env.POSTGRES_IMAGE,keycloakImage:process.env.KEYCLOAK_IMAGE});
  console.log('Private configuration created in .private/nexus. Credentials were not printed.');
}
