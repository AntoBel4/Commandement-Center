import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { auth, family, otherFamily, alice, bob, outsider, headers } from './fixtures.js';
import { CalendarError } from '../src/services/google-calendar.js';

export const proposalBody={title:'Balade fictive',location:'Parc',description:'Test uniquement',slots:[
  {date:'2090-06-01',time:'10:00',endDate:'2090-06-01',endTime:'11:00'},
  {date:'2090-06-02',time:'14:00',endDate:'2090-06-02',endTime:'15:00'}]};
export async function proposalContract(t,makeStore) {
  const events=new Map();let calls=0,lose=false,unavailable=false;
  const calendar={familyId:family,list:async()=>({events:[]}),create:async(body,actor,key)=>{
    calls++;
    if(unavailable)throw new CalendarError(503,'CALENDAR_UNAVAILABLE');
    const id=actor+':'+key;
    if(!events.has(id))events.set(id,{id,body});
    if(lose){lose=false;throw new CalendarError(503,'CALENDAR_UNAVAILABLE');}
    return {event:events.get(id)};
  }};
  const apps=[];
  const open=async()=>{const app=await buildApp({store:makeStore(),auth,calendar,logger:false});apps.push(app);return app;};
  let app=await open();t.after(async()=>{for(const a of apps)await a.close();});
  const post=async(url,body,user=alice,key)=>app.inject({method:'POST',url:'/api/v1/calendar/proposals'+url,
    headers:{...await headers(user),...(key?{'idempotency-key':key}:{})},payload:body});
  const create=async()=>{const r=await post('',proposalBody,alice,randomUUID());assert.equal(r.statusCode,200,r.body);return r.json().data.proposal;};
  const act=async(p,user,action='approve',slot=0,version=p.version)=>post('/'+p.id+'/actions',{version,action,...(action==='approve'?{slot}:{})},user);
  await t.test('posting and one approval never create; different choices wait; same actor cannot count twice',async()=>{
    let p=await create();const before=calls;
    let r=await act(p,alice);assert.equal(r.statusCode,200);p=r.json().data.proposal;assert.equal(p.status,'pending');
    r=await act(p,alice);assert.equal(r.json().data.proposal.version,p.version);assert.equal(calls,before);
    r=await act(p,bob,'approve',1);p=r.json().data.proposal;assert.equal(p.status,'pending');assert.equal(calls,before);
    r=await act(p,alice,'approve',1);assert.equal(r.statusCode,200);p=r.json().data.proposal;
    assert.equal(p.status,'confirmed');assert.equal(calls,before+1);assert.equal(events.get(p.eventId).body.time,'14:00');
    assert.equal((await act(p,bob,'approve',1)).json().data.proposal.status,'confirmed');assert.equal(calls,before+1);
  });
  await t.test('stale choice refuses; withdrawal removes consent; cancel closes proposal',async()=>{
    const initial=await create();let p=(await act(initial,alice)).json().data.proposal;
    const stale=await act(initial,bob);assert.equal(stale.statusCode,409);assert.equal(stale.json().error.code,'PROPOSAL_VERSION');
    p=(await act(p,alice,'withdraw')).json().data.proposal;assert.deepEqual(p.votes,{});
    p=(await act(p,bob)).json().data.proposal;assert.equal(p.status,'pending');
    p=(await act(p,alice,'cancel')).json().data.proposal;assert.equal(p.status,'cancelled');
    assert.equal((await act(p,bob)).statusCode,409);
  });
  await t.test('Google failure preserves both approvals; restart and other member retry use the same event',async()=>{
    let p=await create();p=(await act(p,alice)).json().data.proposal;const before=events.size;lose=true;
    const failed=await act(p,bob);assert.equal(failed.statusCode,503);assert.equal(events.size,before+1);
    app=await open();
    const list=await app.inject({url:'/api/v1/calendar/proposals',headers:await headers()});
    p=list.json().data.proposals.find(x=>x.id===p.id);assert.equal(p.status,'publishing');assert.equal(Object.keys(p.votes).length,2);
    assert.equal((await act(p,alice,'cancel')).statusCode,409);
    const r=await act(p,alice,'retry');assert.equal(r.statusCode,200);assert.equal(r.json().data.proposal.status,'confirmed');assert.equal(events.size,before+1);
  });
  await t.test('simultaneous second approvals and retries publish only one event',async()=>{
    let p=await create();p=(await act(p,alice)).json().data.proposal;unavailable=true;
    assert.equal((await act(p,bob)).statusCode,503);unavailable=false;const before=events.size,previousCalls=calls;
    const results=await Promise.all([act(p,alice,'retry'),act(p,bob,'retry'),act(p,bob)]);
    assert.ok(results.every(r=>r.statusCode===200),results.map(r=>r.body).join('\n'));
    assert.equal(events.size,before+1);assert.equal(calls,previousCalls+1);
  });
  await t.test('simultaneous first votes require a fresh version before second consent',async()=>{
    const p=await create(),before=calls;
    const results=await Promise.all([act(p,alice),act(p,bob)]);
    assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);assert.equal(calls,before);
  });
  await t.test('create is idempotent across reload; body/actor cannot reuse its key',async()=>{
    const key=randomUUID(),one=await post('',proposalBody,alice,key),two=await post('',proposalBody,alice,key);
    assert.equal(one.json().data.proposal.id,two.json().data.proposal.id);
    assert.equal((await post('',{...proposalBody,title:'Different'},alice,key)).statusCode,409);
    assert.equal((await post('',proposalBody,bob,key)).statusCode,409);
  });
  await t.test('anonymous, outsider, other household, Alexa and forged approval are refused',async()=>{
    const url='/api/v1/calendar/proposals';
    assert.equal((await app.inject({url})).statusCode,401);
    assert.equal((await app.inject({url,headers:await headers(outsider)})).statusCode,403);
    assert.equal((await app.inject({url,headers:await headers(outsider,otherFamily)})).statusCode,403);
    assert.equal((await app.inject({url,headers:await headers(alice,family,{azp:'commandement-alexa'})})).statusCode,403);
    const p=await create();
    assert.equal((await post('/'+p.id+'/actions',{version:1,action:'approve',slot:0,actor:bob})).statusCode,400);
    assert.equal((await act(p,alice,'approve',4)).statusCode,400);
    assert.equal((await post('',{...proposalBody,votes:{[alice]:0,[bob]:0}},alice,randomUUID())).statusCode,400);
  });
  await t.test('bad dates, duplicates, past dates and DST ambiguity never save or publish',async()=>{
    const before=calls;
    for(const slots of [[],Array(6).fill(proposalBody.slots[0]),Array(2).fill(proposalBody.slots[0]),
      [{date:'2020-01-01',time:'10:00',endDate:'2020-01-01',endTime:'11:00'}],
      [{date:'2090-02-30',time:'10:00',endDate:'2090-03-01',endTime:'11:00'}],
      [{date:'2090-06-01',time:'11:00',endDate:'2090-06-01',endTime:'10:00'}],
      [{date:'2026-10-25',time:'02:30',endDate:'2026-10-25',endTime:'03:30'}]]) {
      assert.equal((await post('',{...proposalBody,slots},alice,randomUUID())).statusCode,400);
    }
    assert.equal(calls,before);
  });
}
