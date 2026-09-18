// Opt-in: disposable local production stack only, using generated fictitious identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import {alexaClient} from '../prepare-alexa.mjs';
import {createSkill} from '../../../apps/alexa/src/handler.js';

const base=process.env.NEXUS_TEST_BASE;
test('production gateway, real identity, two household members and outsider', {skip:!base}, async()=>{
  assert.equal(new URL(base).hostname,'127.0.0.1');
  const adminBase=process.env.NEXUS_TEST_IDENTITY;
  assert.equal(new URL(adminBase).hostname,'127.0.0.1');
  const directory=new URL('../../../.private/nexus/',import.meta.url);
  const env=Object.fromEntries((await readFile(new URL('production.env',directory),'utf8')).trim().split('\n').map(s=>s.split(/=(.*)/s).slice(0,2)));
  assert.ok(['commandement-nexus-test','commandement-alexa-test'].includes(env.COMPOSE_PROJECT_NAME));
  assert.equal(env.PORTAL_HOST,'family.example.test');
  const origin='https://'+env.PORTAL_HOST;
  const initial=JSON.parse(await readFile(new URL('commandement-realm.json',directory),'utf8'));
  const forwarded={host:env.PORTAL_HOST,'x-forwarded-proto':'https','x-forwarded-port':'443'};
  const adminResponse=await fetch(adminBase+'/auth/realms/master/protocol/openid-connect/token',{
    method:'POST',headers:{...forwarded,'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'bootstrap-admin',password:env.KEYCLOAK_ADMIN_PASSWORD})});
  assert.equal(adminResponse.status,200,'Local bootstrap administrator can authenticate');
  const adminHeaders={...forwarded,authorization:'Bearer '+(await adminResponse.json()).access_token,'content-type':'application/json'};
  const users=initial.users;
  // Exercise the password change for the first fictitious member; the second is already set up.
  for(const user of users) {
    const firstLogin=user===users[0];
    const result=await fetch(adminBase+'/auth/admin/realms/commandement/users/'+user.id,{
      method:'PUT',headers:adminHeaders,body:JSON.stringify({requiredActions:firstLogin?['UPDATE_PASSWORD']:[],firstName:'Demo',lastName:'User',email:user.username+'@example.test',emailVerified:true})});
    assert.equal(result.status,204);
    const reset=await fetch(adminBase+'/auth/admin/realms/commandement/users/'+user.id+'/reset-password',{
      method:'PUT',headers:adminHeaders,body:JSON.stringify({...user.credentials[0],temporary:firstLogin})});
    assert.equal(reset.status,204);
  }
  const visitor={username:'visitor-'+randomUUID(),enabled:true,firstName:'Demo',lastName:'Visitor',
    email:randomUUID()+'@example.test',emailVerified:true,credentials:[{type:'password',temporary:false,value:randomBytes(24).toString('hex')}]};
  const created=await fetch(adminBase+'/auth/admin/realms/commandement/users',{method:'POST',headers:adminHeaders,body:JSON.stringify(visitor)});
  assert.equal(created.status,201);
  const visitorUrl=adminBase+new URL(created.headers.get('location')).pathname;
  const login=async(user, clientId='commandement-center', clientSecret, redirectUri=origin+'/', scope='openid')=>{
    const cookies=new Map();
    const request=async(url,options={})=>{
      assert.ok(url.startsWith(origin+'/')||url.startsWith(base+'/'));
      const response=await fetch(url.replace(origin,base),{...options,redirect:'manual',headers:{
        ...options.headers,host:env.PORTAL_HOST,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});
      for(const cookie of response.headers.getSetCookie()) {
        const pair=cookie.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));
      }
      return response;
    };
    // Alexa sends a large opaque state; preserve it through login and callback.
    const verifier=randomBytes(32).toString('base64url'),state=clientId==='commandement-alexa'
      ? randomBytes(3000).toString('base64url') : randomUUID();
    const query=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope,
      state,nonce:randomUUID(),code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')});
    const response=await request(base+'/auth/realms/commandement/protocol/openid-connect/auth?'+query);
    assert.equal(response.status,200);
    const form=(await response.text()).match(/<form\b[^>]*id="kc-form-login"[^>]*>/)?.[0];
    const action=form?.match(/action="([^"]+)"/)?.[1].replaceAll('&amp;','&');
    assert.ok(action,'HTTPS login form returned through gateway');
    assert.equal(new URL(action).origin,origin);
    let logged=await request(action,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({username:user.username,password:user.credentials[0].value,credentialId:''})});
    if(user===users[0]) {
      for(let hop=0;hop<3 && logged.status===302;hop++) {
        const next=new URL(logged.headers.get('location'));
        if(!next.pathname.startsWith('/auth/')) break;
        logged=await request(next.href);
      }
      assert.equal(logged.status,200,'First login requires a new password');
      const changeForm=(await logged.text()).match(/<form\b[^>]*id="kc-passwd-update-form"[^>]*>/)?.[0];
      const changeAction=changeForm?.match(/action="([^"]+)"/)?.[1].replaceAll('&amp;','&');
      assert.ok(changeAction,'Password change form is available');
      const password=randomBytes(24).toString('hex');
      logged=await request(changeAction,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({'password-new':password,'password-confirm':password})});
    }
    assert.equal(logged.status,302,'Fictitious account completes authorization');
    const redirect=new URL(logged.headers.get('location'));
    assert.equal(redirect.origin,new URL(redirectUri).origin);assert.equal(redirect.searchParams.get('state'),state);
    const tokens=await request(base+'/auth/realms/commandement/protocol/openid-connect/token',{method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded',...(clientSecret?{authorization:'Basic '+Buffer.from(clientId+':'+clientSecret).toString('base64')}:{})},body:new URLSearchParams({grant_type:'authorization_code',
        client_id:clientId,redirect_uri:redirectUri,code:redirect.searchParams.get('code'),code_verifier:verifier})});
    const tokenBody=await tokens.json();
    assert.equal(tokens.status,200,JSON.stringify({error:tokenBody.error,description:tokenBody.error_description}));return tokenBody;
  };
  try {
    for(const path of ['/auth/admin/','/auth/realms/master/','/auth/health/ready','/api/v1/events','/api/v1/sync']) {
      assert.equal((await fetch(base+path)).status,404,'Administrative/integration route is not exposed: '+path);
    }
    assert.equal((await fetch(base+'/api/v1/grocery')).status,401);
    const discovery=await (await fetch(base+'/auth/realms/commandement/.well-known/openid-configuration')).json();
    assert.equal(discovery.issuer,origin+'/auth/realms/commandement');
    const config=await (await fetch(base+'/config.json')).json();
    assert.equal(config.familyId,env.FAMILY_ID);
    const tokens=await Promise.all([...users,visitor].map(user=>login(user)));
    const call=(index,path,options={},token=tokens[index].access_token)=>fetch(base+'/api/v1'+path,{...options,
      headers:{authorization:'Bearer '+token,'x-family-id':env.FAMILY_ID,'content-type':'application/json',...options.headers}});
    const key=randomUUID(),body=JSON.stringify({items:[{name:'Nexus recovery demo'}]});
    const added=await call(0,'/grocery/batch',{method:'POST',headers:{'idempotency-key':key},body});
    assert.equal(added.status,201);
    const item=(await added.json()).data.items[0];
    const repeated=await call(0,'/grocery/batch',{method:'POST',headers:{'idempotency-key':key},body});
    assert.equal((await repeated.json()).data.items[0].id,item.id);
    const shared=await call(1,'/grocery');assert.equal(shared.status,200);
    assert.ok((await shared.json()).data.some(row=>row.id===item.id));
    assert.equal((await call(2,'/grocery')).status,403);
    assert.equal((await call(0,'/grocery',{},tokens[0].id_token)).status,401);
    if(process.env.NEXUS_TEST_ALEXA==='true') {
      const secret=randomBytes(32).toString('hex');
      const redirects=['layla.amazon.com','pitangui.amazon.com','alexa.amazon.co.jp'].map(h=>'https://'+h+'/api/skill/link/TESTVENDOR');
      const priorClients=await (await fetch(adminBase+'/auth/admin/realms/commandement/clients?clientId=commandement-alexa',{headers:adminHeaders})).json();
      for(const client of priorClients) {
        assert.equal(client.clientId,'commandement-alexa');
        assert.equal((await fetch(adminBase+'/auth/admin/realms/commandement/clients/'+client.id,{method:'DELETE',headers:adminHeaders})).status,204);
      }
      const createdClient=await fetch(adminBase+'/auth/admin/realms/commandement/clients',{
        method:'POST',headers:adminHeaders,body:JSON.stringify(alexaClient(redirects,secret))});
      assert.equal(createdClient.status,201,'Dedicated confidential Alexa client created');
      const offlineRole=await (await fetch(adminBase+'/auth/admin/realms/commandement/roles/offline_access',{headers:adminHeaders})).json();
      assert.equal((await fetch(adminBase+'/auth/admin/realms/commandement/users/'+users[1].id+'/role-mappings/realm',{
        method:'POST',headers:adminHeaders,body:JSON.stringify([offlineRole])})).status,204);
      const linked=await login(users[1],'commandement-alexa',secret,redirects[0],'openid offline_access');
      assert.ok(linked.refresh_token,'Alexa receives a renewable linked token');
      const refreshed=await fetch(base+'/auth/realms/commandement/protocol/openid-connect/token',{
        method:'POST',headers:{host:env.PORTAL_HOST,'content-type':'application/x-www-form-urlencoded',
          authorization:'Basic '+Buffer.from('commandement-alexa:'+secret).toString('base64')},
        body:new URLSearchParams({grant_type:'refresh_token',refresh_token:linked.refresh_token})});
      assert.equal(refreshed.status,200,'Alexa HTTP Basic refresh succeeds');
      const linkedToken=(await refreshed.json()).access_token;
      const linkedClaims=JSON.parse(Buffer.from(linkedToken.split('.')[1],'base64url').toString());
      assert.equal(linkedClaims.aud,'commandement-api','Alexa access token has API audience');
      assert.equal(linkedClaims.sub,users[1].id,'Alexa access token identifies the linked member');
      assert.equal((await call(1,'/grocery',{},linkedToken)).status,403,'Alexa cannot read the private list');
      const skillId='amzn1.ask.skill.local-test';
      const articleName='Alexa local demo '+randomUUID();
      const skill=createSkill({skillId,familyId:env.FAMILY_ID,apiBaseUrl:base});
      const envelope={version:'1.0',context:{System:{application:{applicationId:skillId},user:{accessToken:linkedToken}}},
        request:{type:'IntentRequest',requestId:randomUUID(),timestamp:new Date().toISOString(),locale:'fr-FR',
          intent:{name:'AjouterCourse',slots:{article:{name:'article',value:articleName}}}}};
      for(let attempt=0;attempt<2;attempt++) {
        assert.match((await skill.invoke(envelope)).response.outputSpeech.ssml,/J’ai ajouté/);
      }
      const list=(await (await call(0,'/grocery')).json()).data.filter(i=>i.name===articleName);
      assert.equal(list.length,1,'Real identity and PostgreSQL keep a single Alexa addition');
      assert.equal(list[0].source,'alexa');
      assert.equal((await fetch(base+'/integrations/alexa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(envelope)})).status,400,'Public gateway refuses unsigned Alexa calls');
    }
  } finally {
    const removed=await fetch(visitorUrl,{method:'DELETE',headers:adminHeaders});assert.equal(removed.status,204);
  }
});
