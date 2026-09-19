import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {TelegramReminders,scheduledMessages} from '../src/services/telegram-reminders.js';
import {TelegramClient,TelegramError} from '../src/services/telegram-client.js';
import {buildApp} from '../src/app.js';
import {InMemoryStore} from '../src/services/store.js';
import {auth,family,alice,bob,outsider,headers} from './fixtures.js';
import {fixture,link} from './telegram-fixtures.js';
const event={id:'test',title:'Balade',location:'Parc',start:{dateTime:'2026-09-20T06:00:00Z'},end:{dateTime:'2026-09-20T07:00:00Z'},allDay:false};
test('Paris morning, H-1, all-day at 9 and multi-day/recurrence instances use separate keys',()=>{
  const all={id:'day',title:'Anniversaire',allDay:true,start:{date:'2026-09-19'},end:{date:'2026-09-21'}};
  const at=iso=>scheduledMessages([event,all],Date.parse(iso),'https://example.test');
  assert.deepEqual(at('2026-09-20T05:00:00Z').map(x=>x.key),['morning:2026-09-20',at('2026-09-20T05:00:00Z')[1].key]);
  assert.equal(at('2026-09-20T07:00:00Z')[0].key,'all-day:2026-09-20');
  assert.equal(at('2026-09-20T07:16:00Z').length,0);
  assert.equal(scheduledMessages([],Date.parse('2026-10-25T06:00:00Z'),'x')[0].key,'morning:2026-10-25');
  assert.equal(scheduledMessages([],Date.parse('2026-03-29T05:00:00Z'),'x')[0].key,'morning:2026-03-29');
  assert.equal(scheduledMessages([{...event,private:true,title:'SECRET',location:'SECRET'}],Date.parse('2026-09-20T05:00:00Z'),'x').some(x=>x.text.includes('SECRET')),false);
  const many=scheduledMessages(Array.from({length:30},(_,i)=>({...all,id:String(i),title:'x'.repeat(500)})),Date.parse('2026-09-20T05:00:00Z'),'https://example.test');assert.ok(many[0].text.length<4096);
});
test('pairing is private, expiring, single-use, bound to one household member and chat',async()=>{
  const {service,store,setNow}=fixture();const p=await service.pair(alice),code=new URL(p.url).searchParams.get('start');
  const update=(n,chat,type='private')=>({update_id:n,message:{chat:{id:chat,type},from:{id:chat},text:'/start '+code}});
  await service.update(update(1,11,'group'));assert.equal((await service.status(alice)).linked,false);
  await service.update(update(2,11));assert.equal((await service.status(alice)).linked,true);
  await service.update(update(3,12));assert.equal(store.state.links[alice].chat,'11');
  await link(service,bob,11,4);assert.equal((await service.status(bob)).linked,false);
  const expired=await service.pair(bob);setNow('2026-09-20T05:11:00Z');await service.update({...update(5,12),message:{chat:{id:12,type:'private'},from:{id:12},text:'/start '+new URL(expired.url).searchParams.get('start')}});assert.equal((await service.status(bob)).linked,false);
  await assert.rejects(service.pair(outsider));
});
test('one recipient failure does not block the other; uncertain sends never replay after restart',async()=>{
  const f=fixture();await link(f.service,alice,11);await link(f.service,bob,22,2);
  const send=f.client.send;f.client.send=async(chat,text)=>{await send(chat,text);if(chat==='11')throw new TelegramError('TELEGRAM_UNKNOWN');return 2;};
  await f.service.tick();assert.equal(f.messages.length,2);const restart=fixture(f.store);await restart.service.tick();assert.equal(restart.messages.length,0);
  assert.equal((await f.service.status(alice)).lastDelivery.status,'unknown');assert.equal((await f.service.status(bob)).lastDelivery.status,'accepted');
});
test('Google outage sends nothing; latest removal/change, pause and stop are respected',async()=>{
  const f=fixture();await link(f.service,alice,11);f.calendar.list=async()=>{throw Error('upstream');};await f.service.tick();assert.equal(f.messages.length,0);
  assert.equal((await f.service.status(alice)).calendarHealthy,false);
  f.calendar.list=async()=>({events:[event]});await f.service.settings(alice,'quiet');await f.service.tick();assert.equal(f.messages.length,0);
  await f.service.settings(alice,'resume');f.calendar.list=async()=>({events:[]});await f.service.tick();assert.equal(f.messages.length,1);assert.ok(!f.messages[0].text.includes('Balade'));
  await f.service.update({update_id:2,message:{chat:{id:11,type:'private'},from:{id:11},text:'/stop'}});assert.equal((await f.service.status(alice)).linked,false);
});
test('429 retry is bounded and requested test is idempotent',async()=>{
  const f=fixture();await link(f.service,alice,11);const key=randomUUID();await f.service.requestTest(alice,key);await f.service.requestTest(alice,key);
  let calls=0;f.client.send=async()=>{calls++;throw new TelegramError('TELEGRAM_RETRY',1);};
  for(let n=0;n<5;n++){f.setNow('2026-09-20T05:00:0'+n+'Z');await f.service.deliver(alice,'test:'+key,'test');}
  assert.equal(calls,3);await assert.rejects(f.service.requestTest(alice,randomUUID()));
});
test('Telegram errors never expose token, response body or credentials; no hidden retries',async()=>{
  const token='12345:'+ 'secret'.repeat(5);let calls=0;
  const client=new TelegramClient(token,async()=>{calls++;throw Error('private '+token);});
  await assert.rejects(client.send('11','message'),e=>e.message==='TELEGRAM_UNKNOWN'&&!JSON.stringify(e).includes(token));assert.equal(calls,1);
});
test('personal endpoints refuse anonymous, outsider, Alexa and forged preference owner',async t=>{
  const store=new InMemoryStore();store.members.set(family,new Set([alice,bob]));const {service}=fixture();
  const app=await buildApp({store,auth,telegram:service,logger:false});t.after(()=>app.close());
  const url='/api/v1/telegram';assert.equal((await app.inject({url})).statusCode,401);
  assert.equal((await app.inject({url,headers:await headers(outsider)})).statusCode,403);
  assert.equal((await app.inject({url,headers:await headers(alice,family,{azp:'commandement-alexa'})})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:url+'/settings',headers:await headers(),payload:{action:'disable',user:bob}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:url+'/link',headers:await headers(),payload:{}})).statusCode,200);
});
