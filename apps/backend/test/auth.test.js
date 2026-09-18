import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, alice, headers, auth } from './fixtures.js';
import { buildApp } from '../src/app.js';
import { InMemoryStore } from '../src/services/store.js';
import { execFileSync } from 'node:child_process';

test('JWT rejects absent, expired, wrong issuer, wrong audience and invalid subject', async(t)=>{
  const app=await fixture();t.after(()=>app.close());
  assert.equal((await app.inject('/api/v1/grocery')).statusCode,401);
  for(const claims of [
    {exp:1}, {exp:undefined}, {iss:'https://other.example.test'},
    {aud:'another-api',azp:'family-api'}, {sub:'not-a-uuid'}, {iat:undefined}
  ]) {
    const response=await app.inject({url:'/api/v1/grocery',headers:await headers(alice,undefined,claims)});
    assert.equal(response.statusCode,401,JSON.stringify(claims));
  }
  const valid=await headers();
  valid.authorization=valid.authorization.slice(0,-8)+'tampered';
  assert.equal((await app.inject({url:'/api/v1/grocery',headers:valid})).statusCode,401);
});
test('membership is checked on every request and database errors fail closed', async(t)=>{
  const app=await fixture();t.after(()=>app.close());
  const h=await headers();
  assert.equal((await app.inject({url:'/api/v1/grocery',headers:h})).statusCode,200);
  app.store.members.clear();
  assert.equal((await app.inject({url:'/api/v1/grocery',headers:h})).statusCode,403);
  app.store.isFamilyMember=()=>{throw new Error('private database detail');};
  const unavailable=await app.inject({url:'/api/v1/grocery',headers:h});
  assert.equal(unavailable.statusCode,503);
  assert.ok(!unavailable.body.includes('private database detail'));
});
test('health exemption is exact and readiness checks storage', async(t)=>{
  const app=await fixture();t.after(()=>app.close());
  assert.equal((await app.inject('/health')).statusCode,200);
  assert.equal((await app.inject('/health/anything')).statusCode,401);
  assert.equal((await app.inject('/ready')).statusCode,200);
  app.store.checkReady=()=>{throw new Error('private');};
  assert.equal((await app.inject('/ready')).statusCode,503);
});
test('missing auth configuration and production memory/disabled auth fail at startup', async()=>{
  await assert.rejects(buildApp({store:new InMemoryStore(),auth:{enabled:true},logger:false}),/AUTH_ISSUER/);
  for (const statement of [
    "await buildApp({store:new InMemoryStore(),auth:{enabled:false},logger:false})",
    "await buildApp({store:{},auth:{enabled:false},logger:false})"
  ]) {
    assert.throws(()=>execFileSync(process.execPath,['--input-type=module','-e',
      "import {buildApp} from './src/app.js';import {InMemoryStore} from './src/services/store.js';"+statement],
      {cwd:new URL('../',import.meta.url),env:{...process.env,NODE_ENV:'production'},stdio:'pipe'}));
  }
});
