import test from 'node:test';
import assert from 'node:assert/strict';
import {alexaClient} from '../prepare-alexa.mjs';
const urls=['layla.amazon.com','pitangui.amazon.com','alexa.amazon.co.jp'].map(h=>'https://'+h+'/api/skill/link/TESTVENDOR');
test('Alexa client uses exact redirect URIs, PKCE, dedicated audience and no password/service grants',()=>{
  const c=alexaClient(urls,'a'.repeat(64));
  assert.deepEqual(c.redirectUris,urls);assert.equal(c.publicClient,false);
  assert.equal(c.attributes['pkce.code.challenge.method'],'S256');
  assert.equal(c.directAccessGrantsEnabled,false);assert.equal(c.serviceAccountsEnabled,false);
  assert.deepEqual(c.defaultClientScopes,['basic']);assert.equal(c.protocolMappers[0].config['id.token.claim'],'false');
  for(const bad of ['https://evil.test/api/skill/link/TESTVENDOR',urls[0]+'/*',urls[0]+'?next=evil',urls[0].replace('TESTVENDOR','OTHER')]) {
    assert.throws(()=>alexaClient([bad,...urls.slice(1)],'a'.repeat(64)));
  }
});
