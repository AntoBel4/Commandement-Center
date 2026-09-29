import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { jwtVerify } from 'jose';
import { GoogleCalendar, parisInstant, googleEvent, displayEvent } from '../src/services/google-calendar.js';
import { buildApp } from '../src/app.js';
import { InMemoryStore } from '../src/services/store.js';
import { auth, family, otherFamily, alice, bob, outsider, headers } from './fixtures.js';
import { PendingEvent } from '../../web/src/calendar.js';
import { createClient } from '../../web/src/client.js';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const credentials={type:'service_account',client_email:'calendar@example.test',private_key:privateKey.export({type:'pkcs8',format:'pem'}),private_key_id:'test',token_uri:'https://oauth2.googleapis.com/token'};
const body={title:'Sortie test',date:'2026-10-25',time:'10:00',endDate:'2026-10-25',endTime:'11:00',allDay:false,location:'Jardin',description:'Exemple fictif'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
async function setup(t) {
  const events=new Map(); let tokenCalls=0, createCalls=0, fail=false;
  const provider=new GoogleCalendar({credentials,calendarId:'shared@example.test',familyId:family,fetcher:async (url,options={})=>{
    url=String(url);
    if(url==='https://oauth2.googleapis.com/token') {
      tokenCalls++; const jwt=options.body.get('assertion'); const {payload}=await jwtVerify(jwt,publicKey,{issuer:credentials.client_email,audience:url});
      assert.equal(payload.scope,'https://www.googleapis.com/auth/calendar.events'); return response({access_token:'fake-token',expires_in:3600});
    }
    assert.equal(options.headers.authorization,'Bearer fake-token');
    if(fail) return response({error:{message:'DO NOT LEAK'}},503);
    const target=new URL(url);
    if(options.method==='POST') { createCalls++;const e=JSON.parse(options.body); if(events.has(e.id)) return response({},409); events.set(e.id,e);return response(e,201); }
    const id=target.pathname.split('/').at(-1);
    if(id!=='events') return events.has(id)?response(events.get(id)):response({},404);
    return response({items:[...events.values()]});
  }});
  const store=new InMemoryStore(); store.members.set(family,new Set([alice,bob]));store.members.set(otherFamily,new Set([outsider]));
  const app=await buildApp({store,auth,logger:false,calendar:provider});t.after(()=>app.close());
  return {app,provider,events,counts:()=>({tokenCalls,createCalls}),fail:value=>{fail=value;}};
}
test('Paris civil times cross DST correctly and reject missing/ambiguous hours',()=>{
  assert.equal(parisInstant('2026-03-29','01:30'),'2026-03-29T00:30:00.000Z');
  assert.equal(parisInstant('2026-03-29','03:30'),'2026-03-29T01:30:00.000Z');
  assert.throws(()=>parisInstant('2026-03-29','02:30'),{code:'CALENDAR_LOCAL_TIME'});
  assert.throws(()=>parisInstant('2026-10-25','02:30'),{code:'CALENDAR_LOCAL_TIME'});
  const allDay=googleEvent({...body,allDay:true,date:'2026-12-31',endDate:'2027-01-02'});
  assert.deepEqual(allDay.end,{date:'2027-01-03'});
  assert.throws(()=>googleEvent({...body,endTime:'09:00'}),{code:'CALENDAR_END'});
});
test('request replay survives provider restart and does not overwrite a Google edit',async t=>{
  const {provider,events,counts}=await setup(t);const key=randomUUID();
  const first=await provider.create(body,alice,key); assert.equal(first.replayed,false);
  events.get(first.event.id).summary='Changé dans Google'; provider.cachedToken=null;
  const again=await provider.create(body,alice,key);assert.equal(again.replayed,true);assert.equal(again.event.title,'Changé dans Google');assert.equal(events.size,1);
  await assert.rejects(provider.create({...body,title:'Autre'},alice,key),{code:'CALENDAR_KEY_REUSED'});
  events.get(first.event.id).status='cancelled';await assert.rejects(provider.create(body,alice,key),{code:'CALENDAR_CANCELLED'});
  assert.equal(events.size,1);assert.equal(counts().tokenCalls,2);
});
test('listing expands recurrence, follows pages, drops cancellations, hides private details',async()=>{
  const urls=[];let page=0;
  const p=new GoogleCalendar({credentials,calendarId:'shared',familyId:family,fetcher:async(url)=>{
    urls.push(new URL(url));page++;
    return page===1?response({items:[{id:'private',visibility:'private',summary:'secret',description:'secret',location:'secret',start:{date:'2026-10-25'},end:{date:'2026-10-26'}}],nextPageToken:'page2'}):response({items:[{id:'gone',status:'cancelled'},{id:'instance',summary:'Hebdomadaire',recurringEventId:'series',start:{dateTime:'2026-10-26T10:00:00Z'},end:{dateTime:'2026-10-26T11:00:00Z'}}]});
  }});p.cachedToken='fake';p.expiresAt=Date.now()+3600000;
  const r=await p.list({from:'2026-10-25',to:'2026-10-31'});
  assert.equal(urls[0].searchParams.get('singleEvents'),'true');assert.equal(urls[1].searchParams.get('pageToken'),'page2');
  assert.equal(urls[0].searchParams.get('timeMin'),'2026-10-24T22:00:00.000Z');
  assert.equal(r.events.length,2);assert.equal(r.events[0].title,'Occupé');assert.equal(r.events[0].description,'');assert.equal(r.events[0].location,'');assert.equal(r.events[1].recurring,true);
  assert.equal(displayEvent({id:'busy',start:{date:'2026-10-25'}}).title,'Occupé');
});
test('calendar access is family-bound and unavailable to anonymous/outsider/Alexa',async t=>{
  const {app}=await setup(t), url='/api/v1/calendar/events?from=2026-10-01&to=2026-10-31';
  assert.equal((await app.inject({url})).statusCode,401);
  assert.equal((await app.inject({url,headers:await headers(outsider,family)})).statusCode,403);
  assert.equal((await app.inject({url,headers:await headers(outsider,otherFamily)})).statusCode,403);
  assert.equal((await app.inject({url,headers:await headers(alice,family,{azp:'commandement-alexa'})})).statusCode,403);
  const result=await app.inject({url,headers:await headers(bob)});assert.equal(result.statusCode,200);assert.equal(result.headers['cache-control'],'no-store');
  assert.equal((await app.inject({url:url+'&calendarId=other',headers:await headers()})).statusCode,400);
});
test('invalid request is never sent, Google failure is not reported as success or leaked',async t=>{
  const {app,counts,fail}=await setup(t),h={...await headers(),'idempotency-key':randomUUID()};
  const invalid=await app.inject({method:'POST',url:'/api/v1/calendar/events',headers:h,payload:{...body,date:'2026-02-30'}});assert.equal(invalid.statusCode,400);assert.equal(counts().createCalls,0);
  fail(true);const result=await app.inject({method:'POST',url:'/api/v1/calendar/events',headers:h,payload:body});assert.equal(result.statusCode,503);assert.equal(result.json().success,false);assert.ok(!result.body.includes('DO NOT LEAK'));
});
test('browser keeps the same pending request after response loss and page reload',async t=>{
  const {app,events}=await setup(t);const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  let lose=true;const request=createClient({familyId:family,auth:{authenticated:true,token:(await headers()).authorization.slice(7),updateToken:async()=>{}},fetcher:async(url,options)=>{
    const r=await app.inject({url,method:options.method,headers:options.headers,payload:options.body});if(lose){lose=false;throw Error('lost response');}return new Response(r.body,{status:r.statusCode});
  }});
  const pending=new PendingEvent(storage,family+alice);const v=pending.prepare(body);await assert.rejects(pending.send(request));assert.equal(events.size,1);
  const restored=new PendingEvent(storage,family+alice);assert.equal(restored.read().key,v.key);assert.equal(new PendingEvent(storage,family+bob).read(),null);
  const result=await restored.send(request);assert.equal(result.replayed,true);assert.equal(restored.read(),null);assert.equal(events.size,1);
});
