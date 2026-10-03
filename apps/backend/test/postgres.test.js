import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { execFileSync } from 'node:child_process';
import { migrate } from '../scripts/migrate.js';
import { bootstrapFamily } from '../scripts/bootstrap-family.js';
import { PostgresStore } from '../src/services/store.js';
import { fixture, family, otherFamily, alice, bob, outsider, create, headers, call } from './fixtures.js';
import { groceryContract } from './grocery-contract.js';
import { proposalContract } from './proposals-contract.js';

const databaseUrl=process.env.TEST_DATABASE_URL;
test('PostgreSQL integration', {skip:!databaseUrl}, async(t)=>{
  const schema='test_'+randomUUID().replaceAll('-','');
  let admin=new pg.Client({connectionString:databaseUrl});
  await admin.connect();
  await admin.query('create schema '+schema);
  t.after(async()=>{await admin.query('drop schema '+schema+' cascade');await admin.end();});
  const scoped=new URL(databaseUrl);
  scoped.searchParams.set('options','-c search_path='+schema+',public');
  const url=scoped.href;
  await migrate(url);
  await migrate(url);
  await bootstrapFamily({databaseUrl:url,familyId:family,familyName:'Test household',userIds:[alice,bob]});
  await bootstrapFamily({databaseUrl:url,familyId:family,familyName:'Test household',userIds:[alice,bob]});
  await bootstrapFamily({databaseUrl:url,familyId:otherFamily,familyName:'Other test household',
    userIds:[outsider,'dddddddd-dddd-4ddd-8ddd-dddddddddddd']});
  const makeApp=()=>fixture(new PostgresStore(url));
  await groceryContract(t,makeApp);
  await t.test('calendar proposals persist and serialize',async sub=>proposalContract(sub,()=>new PostgresStore(url)));

  await t.test('membership provisioning is repeatable and refuses unintended replacement',async()=>{
    const db=new pg.Client({connectionString:url});await db.connect();
    try {
      assert.equal((await db.query('select count(*) from family_members where family_id=$1',[family])).rows[0].count,'2');
      await assert.rejects(bootstrapFamily({databaseUrl:url,familyId:family,familyName:'Test',userIds:[alice,outsider]}),
        /membership differs/);
      await assert.rejects(bootstrapFamily({databaseUrl:url,familyId:family,familyName:'Test',userIds:[alice,alice.toUpperCase()]}),
        /two distinct/);
      await bootstrapFamily({databaseUrl:url,familyId:family,familyName:'Test',userIds:[alice.toUpperCase(),bob.toUpperCase()]});
    } finally {await db.end();}
  });
  await t.test('batch, data and history roll back together on a database failure',async(t)=>{
    const app=await makeApp();t.after(()=>app.close());
    const count=()=>app.store.pool.query('select count(*) from grocery_items');
    const before=(await count()).rows[0].count;
    await assert.rejects(app.store.addGroceryBatch([{name:'Temporary'},{name:null}],family,{actorId:alice,requestKey:'rollback-test'}));
    assert.equal((await count()).rows[0].count,before);
    assert.equal((await app.store.pool.query("select count(*) from grocery_requests where request_key='rollback-test'")).rows[0].count,'0');
    assert.equal((await app.store.pool.query("select count(*) from grocery_history where after_data->>'name'='Temporary'")).rows[0].count,'0');
  });
  await t.test('new application instance retains data, attribution, history and retry key',async(t)=>{
    const app=await makeApp();
    const [item]=await create(app,[{name:'Restart sample'}],{'idempotency-key':'restart-sample'});
    await call(app,'PUT','/api/v1/grocery/'+item.id,{version:1,purchased:true},bob);
    await app.close();
    const restarted=await makeApp();t.after(()=>restarted.close());
    const persisted=await restarted.store.getGrocery(item.id,family);
    assert.equal(persisted.purchased,true);assert.equal(persisted.purchased_by,bob);
    assert.equal((await restarted.store.listGroceryHistory(item.id,family)).length,2);
    const [retry]=await create(restarted,[{name:'Restart sample'}],{'idempotency-key':'restart-sample'});
    assert.equal(retry.id,item.id);
    assert.equal((await restarted.store.getGrocery(item.id,family)).version,2);
  });
  await t.test('database container restart preserves committed rows', {skip:!process.env.TEST_RESTART_CONTAINER},async()=>{
    const container=process.env.TEST_RESTART_CONTAINER;
    if (!/^cc-t02-db-[0-9]+$/.test(container)) throw new Error('Only the dedicated local T02 test container may restart');
    const config=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
    assert.equal(config.Config.Labels['codex.task'],'cc-t02-20260918');
    assert.equal(config.Config.Env.includes('POSTGRES_DB=cc_test'),true);
    const app=await makeApp();
    const [item]=await create(app,[{name:'Database restart sample'}]);
    await app.close();
    // The schema cleanup connection must be reconnected after restarting PostgreSQL.
    await admin.end();
    execFileSync('docker',['restart',container],{stdio:'pipe',timeout:60000});
    let connected=false;
    for(let attempt=0;attempt<30;attempt++) {
      const probe=new pg.Client({connectionString:url});
      try {await probe.connect();await probe.end();connected=true;break;}
      catch {await probe.end().catch(()=>{});await new Promise((resolve)=>setTimeout(resolve,500));}
    }
    assert.ok(connected,'PostgreSQL restarted');
    admin=new pg.Client({connectionString:databaseUrl});await admin.connect();
    const restarted=await makeApp();
    try {assert.equal((await restarted.store.getGrocery(item.id,family)).name,'Database restart sample');}
    finally {await restarted.close();}
  });
});
