import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Real Bash monitor/common scripts; Docker, PostgreSQL and Telegram are doubles.
// No real credentials, production containers or external messages.
const here = dirname(fileURLToPath(import.meta.url));
const user = '11111111-1111-4111-8111-111111111111';
const exists = async p => { try { await stat(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
const executable = async (p, content) => { await writeFile(p, content); await chmod(p, 0o700); };

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'maison-monitor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scripts = join(root, 'deploy/nexus');
  const priv = join(root, '.private/nexus');
  const bin = join(root, 'bin');
  const work = join(root, 'backup-work');
  const state = join(priv, 'monitor');
  const log = join(root, 'telegram.jsonl');
  await Promise.all([scripts, priv, bin, work].map(p => mkdir(p, { recursive: true })));
  for (const name of ['monitor.sh', 'common.sh']) await copyFile(join(here, '..', name), join(scripts, name));
  await writeFile(join(priv, 'production.env'), '# synthetic only\n');
  await writeFile(join(priv, 'telegram.env'), `TELEGRAM_ALERT_USER=${user}\n`);
  await writeFile(join(priv, 'telegram-token'), 'synthetic-token-only');
  await writeFile(join(priv, 'offsite.env'), `OFFSITE_WORKDIR=${work}\n`);
  await writeFile(join(work, 'last-offsite-success'), new Date().toISOString());
  await executable(join(bin, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
if (a[0] === 'inspect') {
  const service = a.at(-1);
  const down = service === process.env.DOWN_SERVICE;
  console.log(down ? 'exited/unhealthy' : 'running/healthy');
} else if (a[0] === 'compose' && a.includes('ps')) {
  console.log(a.at(-1));
} else if (a[0] === 'compose' && a.includes('psql')) {
  const sql = fs.readFileSync(0, 'utf8');
  if (!sql.includes(":'u'") || !a.includes('u=${user}')) process.exit(90);
  if (process.env.DOWN_SERVICE === 'postgres' || process.env.NO_CHAT) process.exit(1);
  console.log('123456789');
} else process.exit(91);
`);
  await executable(join(bin, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const config = fs.readFileSync(0, 'utf8');
fs.appendFileSync(process.env.SEND_LOG, JSON.stringify({ args, config }) + '\\n');
if (process.env.SEND_FAIL) process.exit(22);
`);
  const run = (env = {}) => spawnSync('bash', [join(scripts, 'monitor.sh')], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SEND_LOG: log, ...env }
  });
  const calls = async () => (await exists(log)) ? (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse) : [];
  return { priv, work, state, run, calls };
}
function ok(result) { assert.equal(result.status, 0, result.stdout + result.stderr); }

test('healthy start caches recipient privately without sending; database outage uses cache', async t => {
  const f = await fixture(t);
  ok(f.run());
  assert.equal((await readFile(join(f.state, 'alert-chat'), 'utf8')).trim(), '123456789');
  assert.equal((await stat(join(f.state, 'alert-chat'))).mode & 0o777, 0o600);
  assert.equal((await f.calls()).length, 0);
  ok(f.run({ DOWN_SERVICE: 'postgres' }));
  assert.equal((await f.calls()).length, 0);
  ok(f.run({ DOWN_SERVICE: 'postgres' }));
  const calls = await f.calls();
  assert.equal(calls.length, 1);
  assert(calls[0].args.includes('chat_id=123456789'));
  assert(calls[0].args.some(x => x.includes('Maison — panne : postgres')));
  assert(!calls[0].args.some(x => x.includes('synthetic-token')));
  assert.match(calls[0].config, /synthetic-token-only/);
  ok(f.run({ DOWN_SERVICE: 'postgres' }));
  assert.equal((await f.calls()).length, 1);
});

test('failure and recovery each need two consecutive observations, with no repeat', async t => {
  const f = await fixture(t);
  ok(f.run());
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.equal((await f.calls()).length, 0);
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.equal((await f.calls()).length, 1);
  assert.equal(await exists(join(f.state, 'pending')), false);
  ok(f.run());
  assert.equal((await f.calls()).length, 1);
  assert.equal(await readFile(join(f.state, 'pending'), 'utf8'), '');
  ok(f.run());
  assert.equal((await f.calls()).length, 2);
  assert((await f.calls())[1].args.some(x => x.includes('Maison — rétabli')));
  ok(f.run());
  assert.equal((await f.calls()).length, 2);
});

test('a transient failure is forgotten after a healthy observation', async t => {
  const f = await fixture(t);
  ok(f.run({ DOWN_SERVICE: 'web' }));
  ok(f.run());
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.equal((await f.calls()).length, 0);
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.equal((await f.calls()).length, 1);
});

test('failed Telegram send is retried without recording delivery', async t => {
  const f = await fixture(t);
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.notEqual(f.run({ DOWN_SERVICE: 'web', SEND_FAIL: '1' }).status, 0);
  assert.equal(await exists(join(f.state, 'state')), false);
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.equal((await f.calls()).length, 2);
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.equal((await f.calls()).length, 2);
});

test('maintenance silences alerts; an expired window does not', async t => {
  const f = await fixture(t);
  await writeFile(join(f.work, 'maintenance'), String(Math.floor(Date.now() / 1000)));
  ok(f.run({ DOWN_SERVICE: 'web' }));
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.equal((await f.calls()).length, 0);
  await writeFile(join(f.work, 'maintenance'), String(Math.floor(Date.now() / 1000) - 2701));
  ok(f.run({ DOWN_SERVICE: 'web' }));
  ok(f.run({ DOWN_SERVICE: 'web' }));
  assert.equal((await f.calls()).length, 1);
});

test('stale backup raises an alert even with healthy containers', async t => {
  const f = await fixture(t);
  await writeFile(join(f.work, 'last-offsite-success'), new Date(Date.now() - 27 * 3600000).toISOString());
  ok(f.run());
  ok(f.run());
  assert.equal((await f.calls()).length, 1);
  assert((await f.calls())[0].args.some(x => x.includes('sauvegarde hors site > 26 h')));
});

test('missing recipient configuration or chat fails visibly even while healthy', async t => {
  const f = await fixture(t);
  const missingChat = f.run({ NO_CHAT: '1' });
  assert.notEqual(missingChat.status, 0);
  assert.match(missingChat.stderr, /Alert chat unknown/);
  await writeFile(join(f.priv, 'telegram.env'), '# missing recipient\n');
  const missingUser = f.run();
  assert.notEqual(missingUser.status, 0);
  assert.match(missingUser.stderr, /TELEGRAM_ALERT_USER not configured/);
  assert.equal((await f.calls()).length, 0);
});
