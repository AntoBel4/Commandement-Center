// Opt-in: disposable local production stack only, using generated fictitious identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';

const base=process.env.NEXUS_TEST_BASE;
test('production gateway, real identity, two household members and outsider', {skip:!base}, async()=>{
  assert.equal(new URL(base).hostname,'127.0.0.1');
  const adminBase=process.env.NEXUS_TEST_IDENTITY;
  assert.equal(new URL(adminBase).hostname,'127.0.0.1');
  const directory=new URL('../../../.private/nexus/',import.meta.url);
  const env=Object.fromEntries((await readFile(new URL('production.env',directory),'utf8')).trim().split('\n').map(s=>s.split(/=(.*)/s).slice(0,2)));
  assert.equal(env.COMPOSE_PROJECT_NAME,'commandement-nexus-test');
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
  const login=async(user)=>{
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
    const verifier=randomBytes(32).toString('base64url'),state=randomUUID();
    const query=new URLSearchParams({client_id:'commandement-center',redirect_uri:origin+'/',response_type:'code',scope:'openid',
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
    assert.equal(redirect.origin,origin);assert.equal(redirect.searchParams.get('state'),state);
    const tokens=await request(base+'/auth/realms/commandement/protocol/openid-connect/token',{method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',
        client_id:'commandement-center',redirect_uri:origin+'/',code:redirect.searchParams.get('code'),code_verifier:verifier})});
    assert.equal(tokens.status,200);return tokens.json();
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
    const tokens=await Promise.all([...users,visitor].map(login));
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
  } finally {
    const removed=await fetch(visitorUrl,{method:'DELETE',headers:adminHeaders});assert.equal(removed.status,204);
  }
});
