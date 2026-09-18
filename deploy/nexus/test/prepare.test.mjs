import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuration, prepare } from '../prepare.mjs';

const input={host:'family.example.test',members:['alice','bob'],release:'1234567',
  postgresImage:'postgres@sha256:'+'a'.repeat(64),keycloakImage:'quay.io/keycloak/keycloak@sha256:'+'b'.repeat(64)};
test('rejects host/username injection and unpinned releases before writing credentials',()=>{
  for(const host of ['https://example.test','localhost','a.example.test\nEVIL=x','example.test/path','127.0.0.1']) {
    assert.throws(()=>configuration({...input,host}));
  }
  assert.throws(()=>configuration({...input,members:['alice','alice']}));
  assert.throws(()=>configuration({...input,members:['alice','bob\nROLE=admin']}));
  assert.throws(()=>configuration({...input,postgresImage:'postgres:latest'}));
  assert.throws(()=>configuration({...input,release:'latest'}));
});
test('identity and portal agree; repeat preparation cannot overwrite accounts or secrets',async()=>{
  const root=await mkdtemp(join(tmpdir(),'nexus-prepare-'));
  try {
    const dir=join(root,'private');
    await prepare(input,dir);
    const env=await readFile(join(dir,'production.env'),'utf8');
    const realm=JSON.parse(await readFile(join(dir,'commandement-realm.json'),'utf8'));
    const portal=JSON.parse(await readFile(join(dir,'portal-config.json'),'utf8'));
    assert.ok(env.includes('FAMILY_ID='+portal.familyId));
    assert.ok(env.includes('KEYCLOAK_USER_IDS='+realm.users.map(u=>u.id).join(',')));
    assert.equal(realm.sslRequired,'all');
    assert.equal(realm.registrationAllowed,false);
    assert.equal(realm.clients[0].directAccessGrantsEnabled,false);
    assert.deepEqual(realm.clients[0].webOrigins,['https://family.example.test']);
    assert.ok(realm.users.every(u=>u.credentials[0].temporary && u.requiredActions.includes('UPDATE_PASSWORD')));
    assert.equal(new Set(realm.users.map(u=>u.credentials[0].value)).size,2);
    await assert.rejects(()=>prepare(input,dir),{code:'EEXIST'});
    assert.equal(await readFile(join(dir,'production.env'),'utf8'),env);
    assert.ok(!JSON.stringify(portal).includes('Password'));
  } finally { await rm(root,{recursive:true,force:true}); }
});
