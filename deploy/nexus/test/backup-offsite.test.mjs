import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, rm, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Execute the real Bash orchestration, tar and OpenSSL in an isolated fixture.
// Database export, age and Docker/S3 are doubles: no production data, credentials,
// network calls or claim of a real age/Contabo integration test here.
const here = dirname(fileURLToPath(import.meta.url));
const original = '2026-01-01T00:00:00Z\n';
const executable = async (path, text) => { await writeFile(path, text); await chmod(path, 0o700); };

async function fixture(t, config = '') {
  const root = await mkdtemp(join(tmpdir(), 'maison-offsite-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scripts = join(root, 'deploy/nexus');
  const priv = join(root, '.private/nexus');
  const bin = join(root, 'bin');
  // A space in the work directory catches unquoted paths in checksum/upload logic.
  const work = join(root, 'backup work');
  await Promise.all([scripts, priv, bin, work].map(p => mkdir(p, { recursive: true })));
  for (const file of ['backup-offsite.sh', 'common.sh']) {
    await copyFile(join(here, '..', file), join(scripts, file));
  }
  await writeFile(join(priv, 'production.env'), '# synthetic test configuration\n');
  await writeFile(join(priv, 'offsite-s3.env'), '# no credentials\n');
  await writeFile(join(priv, 'offsite.env'), `OFFSITE_AGE_RECIPIENT=age1${'a'.repeat(58)}
OFFSITE_WORKDIR='${work}'
OFFSITE_BUCKET=fixture-only
OFFSITE_ENDPOINT=https://s3.example.test
OFFSITE_AWS_IMAGE=example/aws-cli@sha256:${'a'.repeat(64)}
${config}\n`);
  await writeFile(join(work, 'last-offsite-success'), original);
  await executable(join(scripts, 'backup.sh'), `#!/usr/bin/env bash
set -euo pipefail
mkdir -m 700 -- "$1"
printf 'synthetic database payload\\n' > "$1/courses.dump"
(cd -- "$1" && sha256sum courses.dump > SHA256SUMS)
touch "$FAKE_BACKUP_CALLED"
`);
  await executable(join(bin, 'age'), `#!/usr/bin/env node
const fs=require('node:fs');
const args=process.argv.slice(2);
const data=fs.readFileSync(0);
if(process.env.FAKE_AGE_FAIL) process.exit(2);
fs.writeFileSync(args[args.indexOf('-o')+1], Buffer.concat([Buffer.from('TEST-AGE-DOUBLE\\n'), data]));
`);
  await executable(join(bin, 'docker'), `#!/usr/bin/env node
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const args=process.argv.slice(2);
const value=k=>args[args.indexOf(k)+1];
const log=process.env.FAKE_S3_LOG;
const calls=fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\\n').length:0;
fs.appendFileSync(log, JSON.stringify(args)+'\\n');
if(!args.includes('put-object') || args.includes('--if-none-match')) process.exit(91);
const mount=value('-v');
const local=path.join(mount.slice(0,-':/outbox:ro'.length), path.basename(value('--body')));
const data=fs.readFileSync(local);
if(!args.includes('--content-md5') || value('--content-md5')!==crypto.createHash('md5').update(data).digest('base64')) process.exit(92);
if(value('--query')!=='VersionId' || value('--output')!=='text') process.exit(93);
if(Number(process.env.FAKE_FAIL_UPLOAD)===calls+1) process.exit(42);
fs.writeFileSync(path.join(process.env.FAKE_REMOTE,path.basename(local)),data);
if(Number(process.env.FAKE_MISSING_VERSION)===calls+1) console.log(process.env.FAKE_VERSION_RESPONSE ?? 'None');
else console.log('version-'+(calls+1)+'+/=');
`);
  const remote = join(root, 'remote');
  await mkdir(remote);
  const log = join(root, 's3.jsonl');
  const backupCalled = join(root, 'backup.called');
  const run = (env = {}, args = []) => spawnSync('bash', [join(scripts, 'backup-offsite.sh'), ...args], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_S3_LOG: log,
      FAKE_REMOTE: remote, FAKE_BACKUP_CALLED: backupCalled, ...env }
  });
  return {root, work, log, bin, remote, backupCalled, run};
}
const exists = async path => { try { await stat(path); return true; } catch (e) { if(e.code==='ENOENT') return false; throw e; } };
const calls = async f => (await exists(f.log)) ? (await readFile(f.log,'utf8')).trim().split('\n').map(JSON.parse) : [];
const assertNoSuccess = async (f, result) => {
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.equal(await readFile(join(f.work,'last-offsite-success'),'utf8'), original);
  assert.doesNotMatch(result.stdout, /Encrypted archive uploaded/);
  assert.equal(await exists(join(f.work,'maintenance')), false);
};

test('protected versions: both actual payloads have valid Content-MD5, receipt and success marker', async t => {
  const f=await fixture(t);
  const r=f.run();
  assert.equal(r.status,0,r.stdout+r.stderr);
  const requests=await calls(f);
  assert.equal(requests.length,2);
  assert.ok(requests.every(a=>a.includes('AWS_PAGER=')));
  const files=await readdir(join(f.work,'outbox'));
  const archive=files.find(x=>x.endsWith('.tar.age'));
  assert.ok(archive);
  const checksum=await readFile(join(f.remote,archive+'.sha256'),'utf8');
  assert.equal(checksum, `${createHash('sha256').update(await readFile(join(f.remote,archive))).digest('hex')}  ${archive}\n`);
  assert.equal(await readFile(join(f.work,'outbox',archive+'.versions.tsv'),'utf8'),
    `key\tversion_id\nnexus-maison/${archive}\tversion-1+/=\nnexus-maison/${archive}.sha256\tversion-2+/=\n`);
  assert.ok(!files.some(x=>x.endsWith('.partial')));
  assert.notEqual(await readFile(join(f.work,'last-offsite-success'),'utf8'),original);
  assert.equal((await stat(join(f.work,'outbox',archive+'.versions.tsv'))).mode & 0o777,0o600);
  assert.equal(await exists(join(f.work,'maintenance')),false);
});

for(const n of [1,2]) test(`upload ${n} fails: no success marker advance, payloads and partial receipt retained`, async t=>{
  const f=await fixture(t);
  const r=f.run({FAKE_FAIL_UPLOAD:String(n)});
  await assertNoSuccess(f,r);
  assert.equal((await calls(f)).length,n);
  const files=await readdir(join(f.work,'outbox'));
  assert.ok(files.some(x=>x.endsWith('.tar.age')));
  assert.ok(!files.some(x=>x.endsWith('.versions.tsv')));
  const receipt=await readFile(join(f.work,'outbox',files.find(x=>x.endsWith('.versions.tsv.partial'))),'utf8');
  assert.equal(receipt.trim().split('\n').length,n);
});

for(const value of ['None','null','','bad\nversion']) test(`missing/invalid VersionId ${JSON.stringify(value)} fails closed`, async t=>{
  const f=await fixture(t);
  await assertNoSuccess(f,f.run({FAKE_MISSING_VERSION:'2',FAKE_VERSION_RESPONSE:value}));
  assert.equal((await calls(f)).length,2);
  assert.ok(!(await readdir(join(f.work,'outbox'))).some(x=>x.endsWith('.versions.tsv')));
});

for(const config of ['OFFSITE_CHECK=list','OFFSITE_IF_NONE_MATCH=true','OFFSITE_IF_NONE_MATCH=typo','OFFSITE_KEEP_ARCHIVES=0']) {
  test(`reject incompatible configuration before database export: ${config}`, async t=>{
    const f=await fixture(t,config);
    await assertNoSuccess(f,f.run());
    assert.equal(await exists(f.backupCalled),false);
    assert.deepEqual(await calls(f),[]);
  });
}

test('checksum computation failure prevents all uploads and preserves the previous success',async t=>{
  const f=await fixture(t);
  await executable(join(f.bin,'openssl'),'#!/bin/sh\nexit 7\n');
  await assertNoSuccess(f,f.run());
  assert.deepEqual(await calls(f),[]);
});

test('age failure never uploads plaintext or advances success', async t=>{
  const f=await fixture(t);
  await assertNoSuccess(f,f.run({FAKE_AGE_FAIL:'1'}));
  assert.deepEqual(await calls(f),[]);
});

test('--no-upload creates the local archive without S3 calls, receipt or remote success',async t=>{
  const f=await fixture(t,'OFFSITE_CHECK=list\nOFFSITE_IF_NONE_MATCH=true');
  const r=f.run({},['--no-upload']);
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.deepEqual(await calls(f),[]);
  assert.equal(await readFile(join(f.work,'last-offsite-success'),'utf8'),original);
  assert.ok(!(await readdir(join(f.work,'outbox'))).some(x=>x.includes('versions.tsv')));
});

test('local rotation keeps the matching checksum and version receipt; never deletes remote objects',async t=>{
  const f=await fixture(t,'OFFSITE_KEEP_LOCAL=1\nOFFSITE_KEEP_ARCHIVES=1');
  for(let i=0;i<2;i++) { const r=f.run(); assert.equal(r.status,0,r.stdout+r.stderr); }
  const files=await readdir(join(f.work,'outbox'));
  const archives=files.filter(x=>x.endsWith('.tar.age'));
  assert.equal(archives.length,1);
  assert.deepEqual(files.sort(),[archives[0],archives[0]+'.sha256',archives[0]+'.versions.tsv'].sort());
  assert.equal((await readdir(join(f.work,'local'))).length,1);
  assert.equal((await calls(f)).length,4);
  assert.equal((await readdir(f.remote)).length,4);
});
