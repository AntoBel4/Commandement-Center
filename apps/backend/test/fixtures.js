import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { buildApp } from '../src/app.js';
import { InMemoryStore } from '../src/services/store.js';

export const family = '11111111-1111-4111-8111-111111111111';
export const otherFamily = '22222222-2222-4222-8222-222222222222';
export const alice = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const bob = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
const issuer = 'https://identity.example.test/realms/test';
export const auth = { enabled: true, issuer, audience: 'family-api',
  keyResolver: createLocalJWKSet({ keys: [{ ...jwk, alg: 'RS256', kid: 'test' }] }) };
export async function token(user = alice, claims = {}) {
  return new SignJWT({ iss: issuer, aud: 'family-api', sub: user,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(privateKey);
}
export async function headers(user = alice, familyId = family, claims = {}) {
  return { authorization: 'Bearer ' + await token(user, claims), 'x-family-id': familyId };
}
export async function fixture(store = new InMemoryStore()) {
  if (store instanceof InMemoryStore) {
    store.members.set(family, new Set([alice, bob]));
    store.members.set(otherFamily, new Set([outsider]));
  }
  return buildApp({ store, auth, logger: false });
}
export async function call(app, method, url, payload, user = alice, extra = {}) {
  return app.inject({ method, url, payload, headers: { ...await headers(user), ...extra } });
}
export async function create(app, items = [{ name: 'Pain' }], extra = {}) {
  const result = await call(app, 'POST', '/api/v1/grocery/batch', { items }, alice, extra);
  if (result.statusCode !== 201) throw new Error(result.body);
  return result.json().data.items;
}
