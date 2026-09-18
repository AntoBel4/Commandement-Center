import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, PendingAddition, ApiError, civilDate, nextDay, bucket, validateConfig } from '../src/client.js';
import { fixture, alice, bob, family, headers } from '../../backend/test/fixtures.js';

const storage = () => { const values = new Map(); return {getItem:k => values.get(k) ?? null, setItem:(k,v) => values.set(k,v), removeItem:k => values.delete(k)}; };

test('interrupted POST can be resumed after tab reload with one item and one history entry', async t => {
  const app = await fixture(); t.after(() => app.close());
  const auth = {authenticated:true, token:(await headers(alice)).authorization.slice(7), updateToken:async () => {}};
  let loseResponse = true;
  const client = createClient({auth, familyId:family, fetcher:async (url, options) => {
    const response = await app.inject({url, method:options.method, headers:options.headers, payload:options.body});
    if (loseResponse) { loseResponse = false; throw new TypeError('response lost after commit'); }
    return new Response(response.body, {status:response.statusCode});
  }});
  const tab = storage(), pending = new PendingAddition(tab, family + ':' + alice);
  const original = pending.prepare({items:[{name:'Farine', quantity:1, unit:'kg'}]});
  await assert.rejects(pending.send(client), ApiError);
  assert.equal(app.store.listGroceries({familyId:family}).length, 1);
  const restored = new PendingAddition(tab, family + ':' + alice);
  assert.equal(restored.read().key, original.key);
  assert.equal(new PendingAddition(tab, family + ':' + bob).read(), null);
  await restored.send(client);
  assert.equal(restored.read(), null);
  assert.equal(app.store.listGroceries({familyId:family}).length, 1);
  assert.equal(app.store.groceryHistory.length, 1);
});

test('two clients share purchases and reject a stale edit without replay', async t => {
  const app = await fixture(); t.after(() => app.close());
  const makeClient = async user => createClient({familyId:family,
    auth:{authenticated:true, token:(await headers(user)).authorization.slice(7), updateToken:async () => {}},
    fetcher:async (url,options) => {const r = await app.inject({url, method:options.method, headers:options.headers,payload:options.body}); return new Response(r.body,{status:r.statusCode});}});
  const first = await makeClient(alice), second = await makeClient(bob);
  const created = (await first('/grocery/batch',{method:'POST',body:{items:[{name:'Lait'}]},key:'shared-test'})).items[0];
  assert.equal((await second('/grocery'))[0].id, created.id);
  await first('/grocery/' + created.id,{method:'PUT',body:{version:1,assignedTo:alice}});
  await assert.rejects(second('/grocery/' + created.id,{method:'PUT',body:{version:1,status:'purchased'}}), error => error.status === 409);
  const refreshed = (await second('/grocery'))[0];
  assert.equal(refreshed.status, 'open'); assert.equal(refreshed.assigned_to, alice);
  await second('/grocery/' + created.id,{method:'PUT',body:{version:refreshed.version,status:'purchased'}});
  assert.equal((await first('/grocery'))[0].purchased_by, bob);
});

test('expired session fails closed and never sends a request', async () => {
  let calls = 0;
  for (const auth of [{authenticated:false},{authenticated:true,updateToken:async()=>{throw Error('expired');}}]) {
    const client = createClient({auth,familyId:family,fetcher:async()=>{calls++;}});
    await assert.rejects(client('/grocery'), e => e.status === 401);
  }
  assert.equal(calls,0);
});

test('timeouts and malformed responses preserve the pending addition', async () => {
  const auth = {authenticated:true,token:'test',updateToken:async()=>{}};
  for (const fetcher of [async()=>new Response('<html>Error</html>',{status:502}),
    (_url, {signal}) => new Promise((_resolve,reject) => signal.addEventListener('abort',()=>reject(Error('timeout'))))]) {
    const pending = new PendingAddition(storage(),'test'); pending.prepare({items:[{name:'Pain'}]});
    await assert.rejects(pending.send(createClient({auth,familyId:family,fetcher,timeout:5})),ApiError);
    assert.equal(pending.read().body.items[0].name,'Pain');
  }
});

test('an unresolved addition cannot be replaced with different contents', () => {
  const pending = new PendingAddition(storage(),'test'); pending.prepare({items:[{name:'Pain'}]});
  assert.throws(()=>pending.prepare({items:[{name:'Lait'}]}));
  assert.equal(pending.read().body.items[0].name,'Pain');
});

test('Paris civil dates handle midnight, DST and year boundary', () => {
  assert.equal(civilDate(new Date('2026-09-18T22:30:00Z')),'2026-09-19');
  assert.equal(nextDay('2026-10-25'),'2026-10-26');
  assert.equal(nextDay('2026-12-31'),'2027-01-01');
  assert.equal(bucket({status:'open',available_on:'2026-09-19'},'2026-09-18'),'later');
  assert.equal(bucket({status:'open',available_on:'2026-09-19'},'2026-09-19'),'open');
  assert.equal(bucket({status:'purchased',available_on:'2026-09-19'},'2026-09-18'),'purchased');
});

test('configuration rejects missing family and unsafe remote identity URLs', () => {
  assert.throws(()=>validateConfig({familyId:''}));
  for(const url of ['http://remote.example.test','javascript:alert(1)','https://user:password@example.test']) {
    assert.throws(()=>validateConfig({familyId:family,auth:{url,realm:'test',clientId:'test'}}));
  }
  assert.equal(validateConfig({familyId:family,auth:{url:'http://localhost:8081',realm:'test',clientId:'test'}}).familyId,family);
});
