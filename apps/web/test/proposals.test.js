import test from 'node:test';
import assert from 'node:assert/strict';
import { PendingProposal } from '../src/proposals.js';
test('proposal response loss preserves its contents and key across reload, isolated by account',async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const pending=new PendingProposal(storage,'family:alice');
  const body={title:'Balade',slots:[{date:'2090-06-01',time:'10:00',endDate:'2090-06-01',endTime:'11:00'}]};
  const v=pending.prepare(body),saved=new Map();let lost=true;
  const request=async(path,{key,body:payload})=>{assert.equal(path,'/calendar/proposals');saved.set(key,payload);if(lost){lost=false;throw Error('lost');}return{proposal:{id:key}};};
  await assert.rejects(pending.send(request));
  const reload=new PendingProposal(storage,'family:alice');assert.deepEqual(reload.read(),v);
  assert.equal(new PendingProposal(storage,'family:bob').read(),null);
  assert.throws(()=>reload.prepare({...body,title:'Other'}));
  await reload.send(request);assert.equal(saved.size,1);assert.equal(reload.read(),null);
});
