import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { InMemoryStore } from '../src/services/store.js';
import { CalendarProposals } from '../src/services/calendar-proposals.js';
import { family, alice, bob, outsider } from './fixtures.js';
import { proposalBody, proposalContract } from './proposals-contract.js';

test('calendar proposals contract in memory',async t=>{
  const store=new InMemoryStore();store.members.set(family,new Set([alice,bob]));
  await proposalContract(t,()=>store);
});
test('membership changes invalidate consent; expired slots cannot receive second approval',async()=>{
  const store=new InMemoryStore();store.members.set(family,new Set([alice,bob]));let calls=0;
  const service=new CalendarProposals(store,{create:async()=>{calls++;}});
  let p=await service.create(proposalBody,family,alice,randomUUID());
  p=await service.act(family,p.id,alice,{action:'approve',slot:0,version:1});
  store.members.set(family,new Set([alice,outsider]));
  await assert.rejects(service.act(family,p.id,outsider,{action:'approve',slot:0,version:p.version}),{code:'PROPOSAL_MEMBERS'});
  store.members.set(family,new Set([alice,bob]));
  const now=Date.now;Date.now=()=>Date.parse('2091-01-01');
  try {await assert.rejects(service.act(family,p.id,bob,{action:'approve',slot:0,version:p.version}),{code:'PROPOSAL_PAST'});}
  finally {Date.now=now;}
  assert.equal(calls,0);
});
