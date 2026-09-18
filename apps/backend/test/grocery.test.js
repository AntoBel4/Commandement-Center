import test from 'node:test';
import { fixture } from './fixtures.js';
import { groceryContract } from './grocery-contract.js';
test('grocery contract in memory', async(t)=>groceryContract(t,fixture));
