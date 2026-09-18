import assert from 'node:assert/strict';
import { alice, bob, outsider, family, otherFamily, headers, call, create } from './fixtures.js';

export async function groceryContract(t, makeApp) {
  await t.test('two identities share requests; a different family cannot read or mutate them', async (t) => {
    const app = await makeApp(); t.after(() => app.close());
    const [item] = await create(app);
    assert.equal(item.created_by, alice);
    const list = await call(app, 'GET', '/api/v1/grocery', undefined, bob);
    assert.ok(list.json().data.some((row) => row.id === item.id));
    for (const [method, url, payload] of [
      ['GET', '/api/v1/grocery'], ['POST', '/api/v1/grocery/batch', {items:[{name:'intrusion'}]}],
      ['PUT', '/api/v1/grocery/' + item.id, {version:1, purchased:true}],
      ['DELETE', '/api/v1/grocery/' + item.id + '?version=1'],
      ['GET', '/api/v1/grocery/' + item.id + '/history']
    ]) {
      assert.equal((await call(app, method, url, payload, outsider)).statusCode, 403);
    }
    const other = await headers(outsider, otherFamily);
    assert.equal((await app.inject({ method:'PUT', url:'/api/v1/grocery/'+item.id,
      payload:{version:1,purchased:true}, headers:other })).statusCode, 404);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/grocery/'+item.id+'/history',headers:other})).statusCode,404);
  });

  await t.test('same name and incompatible units stay as distinct requests', async (t) => {
    const app = await makeApp(); t.after(() => app.close());
    const items = await create(app, [{name:'Pommes',quantity:2,unit:'kg'}, {name:'Pommes',quantity:3,unit:'pièces'}]);
    assert.notEqual(items[0].id, items[1].id);
    assert.deepEqual(items.map((row)=>[row.quantity,row.unit]), [[2,'kg'],[3,'pièces']]);
    const [again] = await create(app, [{name:'Pommes',quantity:2,unit:'kg'}]);
    assert.notEqual(again.id, items[0].id);
  });

  await t.test('parallel batch retries have one durable result; reusing key with other data conflicts', async (t) => {
    const app = await makeApp(); t.after(() => app.close());
    const key = 'test-' + crypto.randomUUID();
    const requests = await Promise.all(Array.from({length:4}, () =>
      create(app, [{name:'Lait'}], {'idempotency-key':key})));
    assert.equal(new Set(requests.map((items)=>items[0].id)).size,1);
    const conflict = await call(app,'POST','/api/v1/grocery/batch',{items:[{name:'Autre'}]},alice,{'idempotency-key':key});
    assert.equal(conflict.statusCode,409);
    const history = await call(app,'GET','/api/v1/grocery/'+requests[0][0].id+'/history');
    assert.equal(history.json().data.length,1);
  });

  await t.test('lifecycle tracks author, purchase, reopen, report, assignment and cancellation', async (t) => {
    const app = await makeApp(); t.after(() => app.close());
    let [item] = await create(app);
    const id = item.id;
    const update = async (patch, user=bob) => {
      const response = await call(app,'PUT','/api/v1/grocery/'+id,{...patch,version:item.version},user);
      assert.equal(response.statusCode,200,response.body);
      item=response.json().data;
    };
    await update({purchased:true});
    assert.equal(item.purchased_by,bob); assert.ok(item.purchased_at);
    const version=item.version, purchasedAt=item.purchased_at;
    await update({purchased:true});
    assert.equal(item.version,version); assert.equal(item.purchased_at,purchasedAt);
    await update({purchased:false});
    assert.equal(item.purchased_at,null); assert.equal(item.purchased_by,null);
    await update({availableOn:'2026-10-25',urgent:true,assignedTo:alice});
    assert.equal(item.status,'open'); assert.equal(item.available_on,'2026-10-25');
    const before = await call(app,'GET','/api/v1/grocery?availableOn=2026-10-24');
    assert.ok(!before.json().data.some((row)=>row.id===id));
    const denied = await call(app,'PUT','/api/v1/grocery/'+id,{version:item.version,assignedTo:outsider});
    assert.equal(denied.statusCode,400);
    const cancelled=await call(app,'DELETE','/api/v1/grocery/'+id+'?version='+item.version,undefined,bob);
    assert.equal(cancelled.statusCode,200);
    item=cancelled.json().data.item;
    const active=await call(app,'GET','/api/v1/grocery');
    assert.ok(!active.json().data.some((row)=>row.id===id));
    const history=await call(app,'GET','/api/v1/grocery/'+id+'/history');
    assert.deepEqual(history.json().data.map((row)=>row.action),['created','purchased','reopened','rescheduled','cancelled']);
    assert.equal(history.json().data[1].actor_id,bob);
    await update({status:'open'});
    assert.equal(item.status,'open');
  });

  await t.test('concurrent edits reject one stale version without losing accepted changes', async (t) => {
    const app=await makeApp();t.after(()=>app.close());
    const [item]=await create(app);
    const results=await Promise.all([
      call(app,'PUT','/api/v1/grocery/'+item.id,{version:1,quantity:7},alice),
      call(app,'PUT','/api/v1/grocery/'+item.id,{version:1,purchased:true},bob)
    ]);
    assert.deepEqual(results.map((r)=>r.statusCode).sort(),[200,409]);
    const saved=await app.store.getGrocery(item.id,family);
    assert.equal(saved.version,2);
    const winner=results.find((r)=>r.statusCode===200).json().data;
    assert.equal(saved.quantity,winner.quantity); assert.equal(saved.status,winner.status);
    const history=await app.store.listGroceryHistory(item.id,family);
    assert.equal(history.length,2);
  });

  await t.test('invalid data, spoofed actor, absent version and invalid identifiers are rejected', async (t) => {
    const app=await makeApp(); t.after(()=>app.close());
    for(const item of [{name:'Pain',availableOn:'2026-02-30'},{name:'Pain',quantity:0},
      {name:'Pain',quantity:100000000},{name:'Pain',created_by:bob}]) {
      assert.equal((await call(app,'POST','/api/v1/grocery/batch',{items:[item]})).statusCode,400);
    }
    const [item]=await create(app);
    for(const patch of [{purchased:true},{version:1,purchased:true,purchasedBy:'someone'},
      {version:1,status:'open',purchased:true},{version:1}]) {
      assert.equal((await call(app,'PUT','/api/v1/grocery/'+item.id,patch)).statusCode,400);
    }
    assert.equal((await call(app,'PUT','/api/v1/grocery/not-a-uuid',{version:1,purchased:true})).statusCode,400);
    assert.equal((await call(app,'DELETE','/api/v1/grocery/'+item.id)).statusCode,400);
  });
}
