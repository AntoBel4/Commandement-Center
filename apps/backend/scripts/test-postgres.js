import { spawnSync } from 'node:child_process';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to a disposable PostgreSQL test database');
const result = spawnSync(process.execPath, ['--test', 'test/postgres.test.js'], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
