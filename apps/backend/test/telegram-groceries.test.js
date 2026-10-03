import test from 'node:test';
import assert from 'node:assert/strict';
import {InMemoryStore} from '../src/services/store.js';
import {TelegramError} from '../src/services/telegram-client.js';
import {recapItems,recapMessage,recapTimes,parseCapture,parseCallback} from '../src/services/telegram-groceries.js';
import {fixture,link} from './telegram-fixtures.js';
import {family,alice,bob} from './fixtures.js';

const at=(day,time)=>`${day}T${time}:00Z`;
async function setup(now='2026-09-29T15:00:00Z') {
  const f=fixture(),groceries=new InMemoryStore();groceries.members.set(family,new Set([alice,bob]));
  f.service.groceries=groceries;f.service.alertUser=alice;f.setNow(now);
  const sent=[];f.client.send=async(chat,text,markup)=>{sent.push({chat,text,markup});return sent.length;};
  const answers=[];f.client.call=async(method,body)=>{if(method==='answerCallbackQuery')answers.push(body.text);return[];};
  await link(f.service,alice,11,1);await link(f.service,bob,22,2);
  let n=100;const say=(chat,text,from=chat,type='private')=>f.service.update({update_id:n++,message:{chat:{id:chat,type},from:{id:from,is_bot:false},text}});
  const press=(chat,data,from=chat)=>f.service.update({update_id:n++,callback_query:{id:'cb'+n,from:{id:from,is_bot:false},data,message:{chat:{id:chat,type:'private'}}}});
  // The store stamps available_on with the real Paris date; pin it to the simulated day so tests do not depend on the wall clock.
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date(now));
  const add=(name,fields={})=>{const [item]=groceries.addGroceryBatch([{name}],family,{actorId:alice});Object.assign(groceries.groceryItems.find(i=>i.id===item.id),{available_on:today},fields);return item.id;};
  return {...f,groceries,sent,answers,say,press,add};
}

test('recap eligibility: 17:15 cut-off inclusive, postponed and old requests included, urgency never changes the cut-off',()=>{
  const day='2026-09-29',item=(id,fields)=>({id,name:id,status:'open',urgent:false,available_on:day,created_at:at(day,'10:00'),...fields});
  const items=[item('old',{available_on:'2026-09-20',created_at:at('2026-09-20','08:00')}),item('limit',{created_at:at(day,'15:15')}),
    item('after',{created_at:'2026-09-29T15:16:00Z'}),item('urgent-after',{urgent:true,created_at:'2026-09-29T15:16:00Z'}),
    item('tomorrow',{available_on:'2026-09-30'}),item('bought',{status:'purchased'}),item('gone',{status:'cancelled'}),item('urgent',{urgent:true})];
  assert.deepEqual(recapItems(items,day).map(i=>i.id),['urgent','old','limit']);
  assert.equal(recapMessage([],day,'https://example.test/').text,'Maison · Courses du jour\nRien à acheter aujourd’hui.\nhttps://example.test/');
  // Europe/Paris including both clock changes: summer UTC+2, winter UTC+1.
  assert.equal(new Date(recapTimes('2026-09-29').cutoff).toISOString(),'2026-09-29T15:15:00.000Z');
  assert.equal(new Date(recapTimes('2026-10-25').at).toISOString(),'2026-10-25T16:20:00.000Z');
  assert.equal(new Date(recapTimes('2026-03-29').probe).toISOString(),'2026-03-29T15:30:00.000Z');
  assert.equal(new Date(recapTimes('2026-10-24').at).toISOString(),'2026-10-24T15:20:00.000Z');
});

test('capture parsing and button data are bounded',()=>{
  assert.equal(parseCapture('/stop'),null);assert.equal(parseCapture('  \n '),null);
  assert.deepEqual(parseCapture(' Lait \n\nPain').names,['Lait','Pain']);
  assert.ok(parseCapture(Array(11).fill('x').join('\n')).error);assert.ok(parseCapture('x'.repeat(256)).error);
  assert.equal(parseCallback('g:b:not-an-id'),null);assert.equal(parseCallback('g:z:'+'0'.repeat(36)),null);
  const id='3f2c1a4e-0000-4000-8000-000000000001';assert.deepEqual(parseCallback('g:t:'+id),{action:'tomorrow',id});
  const markup=recapMessage([{id,name:'x'.repeat(200),status:'open',urgent:false,available_on:'2026-09-29',created_at:at('2026-09-29','08:00')}],'2026-09-29','x').markup;
  for(const b of markup.inline_keyboard.flat())assert.ok(Buffer.byteLength(b.callback_data)<=64);
});

test('capture is confirmed only after the durable write, once, and only from a linked private chat',async()=>{
  const f=await setup();
  const add=f.groceries.addGroceryBatch.bind(f.groceries);let fail=true;
  f.groceries.addGroceryBatch=async(...a)=>{if(fail)throw Error('database down');return add(...a);};
  await assert.rejects(f.service.update({update_id:50,message:{chat:{id:11,type:'private'},from:{id:11},text:'Lait\nPain'}}));
  await f.service.tick();assert.equal(f.sent.length,0);assert.equal(f.store.state.outbox?.length??0,0);
  fail=false;
  await f.service.update({update_id:50,message:{chat:{id:11,type:'private'},from:{id:11},text:'Lait\nPain'}});
  // A crash before the offset commit replays the same update_id: the idempotency key prevents a duplicate.
  await f.service.applyGrocery({kind:'capture',user:alice,names:['Lait','Pain']},50);
  await f.service.update({update_id:50,message:{chat:{id:11,type:'private'},from:{id:11},text:'Lait\nPain'}});
  const items=await f.groceries.listGroceries({familyId:family});
  assert.deepEqual(items.map(i=>[i.name,i.source,i.created_by,i.status]),[['Lait','telegram',alice,'open'],['Pain','telegram',alice,'open']]);
  await f.service.tick();await f.service.tick();
  assert.equal(f.sent.length,1);assert.equal(f.sent[0].chat,'11');assert.match(f.sent[0].text,/2 courses ajoutées/);
  assert.equal(f.sent[0].markup.inline_keyboard.length,2);
  await f.say(33,'Intrus');await f.say(22,'Groupe',22,'group');await f.say(22,'Usurpé',11);await f.say(22,'/aide');
  assert.equal((await f.groceries.listGroceries({familyId:family})).length,2);
});

test('buttons: bought closes, tomorrow postpones, urgent marks, cancel removes; actions are shared and refused for outsiders',async()=>{
  const f=await setup('2026-09-29T20:00:00Z');const milk=f.add('Lait'),bread=f.add('Pain'),eggs=f.add('Œufs'),jam=f.add('Confiture');
  await f.press(33,'g:b:'+milk);await f.press(22,'g:b:'+milk,11);
  assert.equal((await f.groceries.getGrocery(milk,family)).status,'open');
  await f.press(22,'g:b:'+milk);const bought=await f.groceries.getGrocery(milk,family);
  assert.equal(bought.status,'purchased');assert.equal(bought.purchased_by,bob);
  await f.press(11,'g:c:'+milk);assert.equal((await f.groceries.getGrocery(milk,family)).status,'purchased');
  // 22:00 Paris on 29 September: tomorrow is the 30th in Paris.
  await f.press(11,'g:t:'+bread);assert.equal((await f.groceries.getGrocery(bread,family)).available_on,'2026-09-30');
  await f.press(11,'g:t:'+bread);assert.equal((await f.groceries.getGrocery(bread,family)).available_on,'2026-09-30');
  await f.press(11,'g:u:'+eggs);assert.equal((await f.groceries.getGrocery(eggs,family)).urgent,true);
  await f.press(22,'g:c:'+jam);assert.equal((await f.groceries.getGrocery(jam,family)).status,'cancelled');
  await f.press(11,'g:b:00000000-0000-4000-8000-000000000000');
  assert.deepEqual(f.answers,['Action non disponible.','Action non disponible.','Acheté : Lait','Déjà achetée.','Reporté à demain : Pain','Déjà prévue plus tard.','Marqué urgent : Œufs','Retiré de la liste : Confiture','Course introuvable.']);
});

test('urgent notifies the other member immediately, once, during a quiet day (D5) but never when suspended',async()=>{
  const f=await setup();const legacy=f.add('Déjà urgent',{urgent:true});
  await f.service.tick();assert.equal(f.sent.length,0,'pre-existing urgent requests are not replayed');
  const eggs=f.add('Œufs');await f.service.settings(bob,'quiet');
  await f.press(11,'g:u:'+eggs);await f.service.tick();await f.service.tick();
  const urgent=f.sent.filter(m=>m.text.includes('Course urgente'));
  assert.equal(urgent.length,1);assert.equal(urgent[0].chat,'22');assert.match(urgent[0].text,/Œufs/);
  await f.service.settings(bob,'disable');const salt=f.add('Sel');await f.press(11,'g:u:'+salt);await f.service.tick();
  assert.equal(f.sent.filter(m=>m.text.includes('Course urgente')).length,1);
  // Urgent from the portal (no Telegram action) is detected too; the author is not notified.
  await f.service.settings(bob,'enable');const tea=f.add('Thé');f.groceries.updateGrocery(tea,{urgent:true,version:1},family,bob);
  await f.service.tick();const last=f.sent.at(-1);assert.equal(last.chat,'11');assert.match(last.text,/Thé/);
  assert.ok(legacy);
});

test('17:20 recap goes to both members, respects personal pause and quiet day, and is sent once',async()=>{
  const f=await setup('2026-09-29T15:20:00Z');
  f.add('Avant coupure',{created_at:'2026-09-29T15:10:00Z'});f.add('Après coupure',{created_at:'2026-09-29T15:16:00Z'});
  f.add('Reporté à aujourd’hui',{available_on:'2026-09-29',created_at:'2026-09-27T08:00:00Z'});f.add('Demain',{available_on:'2026-09-30',created_at:'2026-09-29T08:00:00Z'});
  await f.service.tick();await f.service.tick();
  const recaps=f.sent.filter(m=>m.text.startsWith('Maison · Courses du jour'));
  assert.deepEqual(recaps.map(m=>m.chat).sort(),['11','22']);
  assert.match(recaps[0].text,/Avant coupure/);assert.match(recaps[0].text,/Reporté/);
  assert.ok(!recaps[0].text.includes('Après coupure'));assert.ok(!/\n• Demain/.test(recaps[0].text));
  const g=await setup('2026-09-29T15:21:00Z');await g.service.settings(alice,'quiet');await g.service.settings(bob,'disable');await g.service.tick();
  assert.equal(g.sent.length,0);
  const h=await setup('2026-09-29T15:31:00Z');await h.service.tick();assert.equal(h.sent.filter(m=>m.text.startsWith('Maison · Courses')).length,0,'no late recap after the window');
});

test('17:30 probe alerts only the operator when Telegram did not accept an expected recap',async()=>{
  const f=await setup('2026-09-29T15:20:00Z');
  const send=f.client.send;f.client.send=async(chat,text,markup)=>{if(chat==='22'&&text.includes('Courses du jour'))throw new TelegramError('TELEGRAM_UNKNOWN');return send(chat,text,markup);};
  await f.service.tick();f.setNow('2026-09-29T15:30:00Z');await f.service.tick();await f.service.tick();
  const alerts=f.sent.filter(m=>m.text.includes('Alerte exploitation'));
  assert.equal(alerts.length,1);assert.equal(alerts[0].chat,'11');assert.match(alerts[0].text,/1 membre\(s\) sur 2/);
  const status=await f.service.status(bob);assert.deepEqual(status.groceries.probe,{day:'2026-09-29',expected:2,accepted:1});
  assert.equal(status.groceries.lastRecap.status,'unknown');
  const ok=await setup('2026-09-29T15:20:00Z');await ok.service.settings(bob,'quiet');await ok.service.tick();ok.setNow('2026-09-29T15:31:00Z');await ok.service.tick();
  assert.equal(ok.sent.filter(m=>m.text.includes('Alerte')).length,0,'quiet member is not expected; acceptance only');
  assert.deepEqual((await ok.service.status(alice)).groceries.probe,{day:'2026-09-29',expected:1,accepted:1});
});

test('PostgreSQL: replayed capture, concurrent workers, single recap and single urgent notification',{skip:!process.env.TEST_DATABASE_URL},async t=>{
  const [{default:pg},{migrate},{bootstrapFamily},{TelegramStore},{PostgresStore},{randomUUID}]=await Promise.all([import('pg'),import('../scripts/migrate.js'),import('../scripts/bootstrap-family.js'),import('../src/services/telegram-store.js'),import('../src/services/store.js'),import('node:crypto')]);
  const admin=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await admin.connect();
  const schema='test_tgg_'+randomUUID().replaceAll('-','');await admin.query('create schema '+schema);
  const url=new URL(process.env.TEST_DATABASE_URL);url.searchParams.set('options','-c search_path='+schema+',public');
  const pool=new pg.Pool({connectionString:url.href}),groceries=new PostgresStore(url.href);
  t.after(async()=>{await pool.end();await groceries.close();await admin.query('drop schema '+schema+' cascade');await admin.end();});
  await migrate(url.href);await bootstrapFamily({databaseUrl:url.href,familyId:family,familyName:'Fictitious',userIds:[alice,bob]});
  const sent=[],workers=[fixture(new TelegramStore(pool)),fixture(new TelegramStore(pool))];
  for(const w of workers){w.service.groceries=groceries;w.setNow('2026-09-29T15:00:00Z');w.client.send=async(chat,text)=>{sent.push({chat,text});return sent.length;};w.client.call=async()=>[];}
  const [one,two]=workers;await link(one.service,alice,11,1);await link(one.service,bob,22,2);
  const capture={update_id:40,message:{chat:{id:11,type:'private'},from:{id:11},text:'Lait'}};
  await one.service.applyGrocery({kind:'capture',user:alice,names:['Lait']},40);
  await Promise.all([one.service.update(capture),two.service.update(capture)]);
  // The database clock is real: pin the request inside the tested day, before the cut-off.
  await pool.query("update grocery_items set created_at='2026-09-29T10:00:00Z', available_on='2026-09-29'");
  const items=await groceries.listGroceries({familyId:family});assert.equal(items.length,1);assert.equal(items[0].source,'telegram');
  await Promise.all([one.service.tick(),two.service.tick()]);await one.service.tick();
  assert.equal(sent.filter(m=>m.text.includes('Course ajoutée')).length,1);
  await one.service.update({update_id:41,callback_query:{id:'cb',from:{id:22},data:'g:u:'+items[0].id,message:{chat:{id:22,type:'private'}}}});
  await Promise.all([one.service.tick(),two.service.tick()]);await two.service.tick();
  const urgent=sent.filter(m=>m.text.includes('Course urgente'));assert.equal(urgent.length,1);assert.equal(urgent[0].chat,'11');
  for(const w of workers)w.setNow('2026-09-29T15:20:30Z');
  await Promise.all([one.service.tick(),two.service.tick()]);await one.service.tick();
  const recaps=sent.filter(m=>m.text.startsWith('Maison · Courses du jour'));
  assert.deepEqual(recaps.map(m=>m.chat).sort(),['11','22']);assert.match(recaps[0].text,/❗ Lait/);
  const state=JSON.stringify((await pool.query('select data from telegram_state')).rows[0].data);
  assert.ok(!state.includes('Lait'),'no grocery text in Telegram state or receipts');
});

test('a long recap stays under the Telegram message limit',()=>{
  const items=Array.from({length:80},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),name:'é'.repeat(255),quantity:99999999.99,unit:'u'.repeat(50),status:'open',urgent:i%2===0,available_on:'2026-09-29',created_at:'2026-09-29T08:00:00Z'}));
  const message=recapMessage(items,'2026-09-29','https://famille.example.test/');
  assert.ok(Array.from(message.text).length<4096);assert.match(message.text,/Suite et autres boutons dans Maison/);
  assert.equal(message.markup.inline_keyboard.length,12);
});
