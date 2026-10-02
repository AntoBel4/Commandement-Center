import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, rm, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Real Bash/tar/sha256sum, synthetic plaintext, Docker stub. These tests do NOT
// prove PostgreSQL/Keycloak restoration or Windows/SSH transport.
const here = dirname(fileURLToPath(import.meta.url));
const name = 'commandement-20261002T000000Z-1234abcd';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'restore-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const scripts = join(root, 'scripts'), bin = join(root, 'bin');
  const input = join(root, 'input'), work = join(root, 'temporary');
  const backup = join(input, name), log = join(root, 'docker.jsonl');
  await Promise.all([scripts, bin, backup, work].map(p => mkdir(p, {recursive: true})));
  for (const file of ['restore-service.sh', 'rehearsal.yml']) {
    await copyFile(join(here, '..', file), join(scripts, file));
  }
  const files = {
    'courses.dump': 'synthetic courses', 'identity.dump': 'synthetic identity',
    'courses.counts': '1|2|3|4|5\n', 'identity.counts': '2|3|4\n',
    'source-commit.txt': 'a'.repeat(40) + '\n',
    'production.env': 'POSTGRES_IMAGE=postgres:test\nPOSTGRES_PASSWORD=fake\nKEYCLOAK_DB_PASSWORD=fake\nKEYCLOAK_IMAGE=keycloak:test\nPORTAL_HOST=example.test\nRELEASE=test\nDATABASE_URL=postgres://fake\n'
  };
  await Promise.all(Object.entries(files).map(([f, data]) => writeFile(join(backup, f), data)));
  await writeFile(join(backup, 'SHA256SUMS'), Object.entries(files).map(([f, data]) => `${hash(data)}  ${f}\n`).join(''));
  await writeFile(join(bin, 'age'), '#!/bin/sh\necho unexpected-age-invocation >&2\nexit 88\n');
  await chmod(join(bin, 'age'), 0o700);
  await writeFile(join(bin, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.DOCKER_LOG, JSON.stringify(a)+'\\n');
if (a.includes('pg_restore')) {
  fs.readFileSync(0);
  if (process.env.FAIL_RESTORE) process.exit(42);
}
if (a.includes('psql')) console.log(a.includes('keycloak-db') ? '2|3|4' : (process.env.BAD_COUNTS ? '0' : '1|2|3|4|5'));
if (a.includes('config')) console.log('networks: {rehearsal: {internal: true}}');
if (a.includes('node')) console.log(a.at(-1).includes('127.0.0.1') ? 'api /ready 200' : 'keycloak ready 200');
`);
  await chmod(join(bin, 'docker'), 0o700);
  const tar = (extra = []) => {
    const r = spawnSync('tar', ['-C', input, ...extra, '-cf', '-', name]);
    assert.equal(r.status, 0, r.stderr.toString());
    return r.stdout;
  };
  const run = (data, {args, env = {}, checksum = hash(data)} = {}) => spawnSync('bash', [
    join(scripts, 'restore-service.sh'), ...(args ?? ['--rehearse']),
    '--decrypted-stdin', '--tar-sha256', checksum, name
  ], {input: data, encoding: 'utf8', timeout: 15000,
    env: {...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: work, DOCKER_LOG: log, ...env}});
  const calls = async () => {
    try { return (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse); }
    catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  };
  return {root, backup, work, scripts, tar, run, calls};
}
async function rejectedCleanly(f, result) {
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(await readdir(f.work), []);
  assert.deepEqual(await f.calls(), []);
}

test('PC-decrypted input: verifies hashes, rehearses only in isolated project, cleans plaintext and volumes', async t => {
  const f = await fixture(t), r = f.run(f.tar());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /complete stream SHA-256 verified/);
  assert.match(r.stdout, /SHA256SUMS verified/);
  assert.match(r.stdout, /counts match/);
  const calls = await f.calls();
  assert.ok(calls.every(a => a[a.indexOf('-p')+1].startsWith('commandement-rehearsal-')));
  assert.ok(calls.every(a => a[a.indexOf('-f')+1].endsWith('/rehearsal.yml')));
  assert.ok(!calls.some(a => a.includes('stop') || a.some(x => x.includes('drop database'))));
  assert.ok(calls.at(-1).includes('down') && calls.at(-1).includes('-v'));
  assert.deepEqual(await readdir(f.work), []);
});

test('with-services exercises both readiness probes and still removes the isolated project', async t => {
  const f = await fixture(t), r = f.run(f.tar(), {args: ['--rehearse', '--with-services']});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /api \/ready 200/);
  assert.match(r.stdout, /keycloak ready 200/);
  assert.equal((await f.calls()).filter(a => a.includes('node')).length, 2);
  assert.deepEqual(await readdir(f.work), []);
});

for (const checksum of ['', 'not-a-digest', '0'.repeat(64)]) test(`reject missing/wrong tar digest: ${checksum.slice(0,12)}`, async t => {
  const f = await fixture(t);
  await rejectedCleanly(f, f.run(f.tar(), {checksum}));
});

test('truncated transport rejected before Docker even when removed bytes are tar padding', async t => {
  const f = await fixture(t), data = f.tar();
  await rejectedCleanly(f, f.run(data.subarray(0, -512), {checksum: hash(data)}));
});

test('inner file altered after manifest creation is rejected before Docker', async t => {
  const f = await fixture(t);
  await writeFile(join(f.backup, 'courses.dump'), 'altered');
  await rejectedCleanly(f, f.run(f.tar()));
});

test('reject traversal and extra roots before extraction', async t => {
  const f = await fixture(t);
  await rejectedCleanly(f, f.run(f.tar(['--transform', `s|${name}|../outside|`])));
});

test('reject symlinks before extraction', async t => {
  const f = await fixture(t);
  await symlink('/etc/passwd', join(f.backup, 'link'));
  await rejectedCleanly(f, f.run(f.tar()));
});

test('reject checksum paths outside the backup directory', async t => {
  const f = await fixture(t);
  await writeFile(join(f.backup, 'SHA256SUMS'), `${'0'.repeat(64)}  /etc/passwd\n`);
  await rejectedCleanly(f, f.run(f.tar()));
});

for (const env of [{FAIL_RESTORE: '1'}, {BAD_COUNTS: '1'}]) test(`failed rehearsal cleans plaintext/project: ${Object.keys(env)[0]}`, async t => {
  const f = await fixture(t), r = f.run(f.tar(), {env});
  assert.notEqual(r.status, 0);
  assert.ok((await f.calls()).at(-1).includes('down'));
  assert.deepEqual(await readdir(f.work), []);
});

test('production still requires explicit matching confirmation and prior-backup directory', async t => {
  const f = await fixture(t), data = f.tar();
  await rejectedCleanly(f, f.run(data, {args: ['--production']}));
  await rejectedCleanly(f, f.run(data, {args: ['--production', '--confirm', name]}));
});
