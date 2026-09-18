import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { PostgresStore } from '../src/services/store.js';
import { migrate } from '../scripts/migrate.js';
import { bootstrapFamily } from '../scripts/bootstrap-family.js';

const base=process.env.KEYCLOAK_TEST_URL;
const databaseUrl=process.env.TEST_DATABASE_URL;
test('real Keycloak authorization-code PKCE sessions and PostgreSQL', {skip:!base||!databaseUrl}, async(t)=>{
  assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Only a local disposable identity server is allowed');
  const realm=base+'/realms/commandement';
  const login=async(username,password)=>{
    const cookies=new Map();
    const request=async(url,options={})=>{
      const response=await fetch(url,{...options,redirect:'manual',headers:{
        ...options.headers,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});
      for(const cookie of response.headers.getSetCookie()) {
        const pair=cookie.split(';')[0],i=pair.indexOf('=');
        cookies.set(pair.slice(0,i),pair.slice(i+1));
      }
      return response;
    };
    const verifier=randomBytes(32).toString('base64url');
    const state=randomUUID();
    const query=new URLSearchParams({client_id:'commandement-center',redirect_uri:'http://localhost:4173/',
      response_type:'code',scope:'openid',state,nonce:randomUUID(),code_challenge_method:'S256',
      code_challenge:createHash('sha256').update(verifier).digest('base64url')});
    const page=await request(realm+'/protocol/openid-connect/auth?'+query);
    assert.equal(page.status,200);
    const html=await page.text();
    const form=html.match(/<form\b[^>]*id="kc-form-login"[^>]*>/)?.[0];
    const action=form?.match(/action="([^"]+)"/)?.[1].replaceAll('&amp;','&');
    assert.ok(action,'Login form is available');
    assert.equal(new URL(action).origin,new URL(base).origin);
    const loginResponse=await request(action,{method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({username,password,credentialId:''})});
    assert.equal(loginResponse.status,302,'The user completes login without required actions');
    const redirect=new URL(loginResponse.headers.get('location'));
    assert.equal(redirect.origin,'http://localhost:4173');
    assert.equal(redirect.searchParams.get('state'),state);
    const tokens=await fetch(realm+'/protocol/openid-connect/token',{method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'authorization_code',client_id:'commandement-center',
        redirect_uri:'http://localhost:4173/',code:redirect.searchParams.get('code'),code_verifier:verifier})});
    assert.equal(tokens.status,200);
    return tokens.json();
  };

  const adminResponse=await fetch(base+'/realms/master/protocol/openid-connect/token',{method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:process.env.KEYCLOAK_TEST_ADMIN,
      password:process.env.KEYCLOAK_TEST_PASSWORD})});
  assert.equal(adminResponse.status,200);
  const adminToken=(await adminResponse.json()).access_token;
  const adminHeaders={authorization:'Bearer '+adminToken,'content-type':'application/json'};
  const users=[];
  t.after(async()=>{for(const user of users) await fetch(base+'/admin/realms/commandement/users/'+user.id,
    {method:'DELETE',headers:adminHeaders});});
  for(let i=0;i<3;i++) {
    const username='cc-test-'+randomUUID();
    const password=randomBytes(24).toString('base64url');
    const response=await fetch(base+'/admin/realms/commandement/users',{method:'POST',headers:adminHeaders,
      body:JSON.stringify({username,enabled:true,firstName:'Demo',lastName:'User',email:username+'@example.test',
        emailVerified:true,credentials:[{type:'password',temporary:false,value:password}]})});
    assert.equal(response.status,201);
    users.push({id:response.headers.get('location').split('/').pop(),username,password});
  }
  const tokens=await Promise.all(users.map((user)=>login(user.username,user.password)));
  const schema='test_'+randomUUID().replaceAll('-',''),familyId=randomUUID();
  const admin=new pg.Client({connectionString:databaseUrl});await admin.connect();
  await admin.query('create schema '+schema);
  t.after(async()=>{await admin.query('drop schema '+schema+' cascade');await admin.end();});
  const scoped=new URL(databaseUrl);scoped.searchParams.set('options','-c search_path='+schema+',public');
  await migrate(scoped.href);
  await bootstrapFamily({databaseUrl:scoped.href,familyId,familyName:'Demo household',userIds:users.slice(0,2).map((u)=>u.id)});
  const createApp=()=>buildApp({store:new PostgresStore(scoped.href),logger:false,auth:{
    enabled:true,issuer:realm,audience:'commandement-api',jwksUrl:realm+'/protocol/openid-connect/certs'}});
  let app=await createApp();
  let address=await app.listen({host:'127.0.0.1',port:0});
  t.after(()=>app.close());
  const call=(index,method,path,payload,accessToken=tokens[index].access_token)=>fetch(address+path,{
    method,headers:{authorization:'Bearer '+accessToken,'x-family-id':familyId,...(payload?{'content-type':'application/json'}:{})},
    body:payload?JSON.stringify(payload):undefined});
  const created=await call(0,'POST','/api/v1/grocery/batch',{items:[{name:'Demo course'}]});
  assert.equal(created.status,201);
  const item=(await created.json()).data.items[0];
  const shared=await call(1,'GET','/api/v1/grocery');
  assert.equal(shared.status,200);
  assert.equal((await shared.json()).data[0].id,item.id);
  assert.equal((await call(2,'GET','/api/v1/grocery')).status,403);
  assert.equal((await call(0,'GET','/api/v1/grocery',undefined,tokens[0].id_token)).status,401);
  const purchase=await call(1,'PUT','/api/v1/grocery/'+item.id,{version:1,purchased:true});
  assert.equal(purchase.status,200);
  assert.equal((await purchase.json()).data.purchased_by,users[1].id);
  await app.close();
  app=await createApp();address=await app.listen({host:'127.0.0.1',port:0});
  const persisted=await call(0,'GET','/api/v1/grocery');
  assert.equal((await persisted.json()).data[0].purchased,true);
});
