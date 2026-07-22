import { randomUUID } from 'node:crypto';
import { PostgresStore } from './services/store.js';
import { getSyncProvider } from './services/sync-providers.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the sync worker');
}

const store = new PostgresStore();
const workerId = `worker-${randomUUID()}`;
const pollIntervalMs = Number(process.env.SYNC_POLL_INTERVAL_MS ?? 5000);
let stopping = false;

async function processNextJob() {
  const job = await store.claimNextSyncJob(workerId);
  if (!job) return false;
  try {
    await getSyncProvider(job.service).execute(job);
    await store.completeSyncJob(job.id, { workerId });
  } catch (error) {
    await store.failSyncJob(job.id, error instanceof Error ? error.message : String(error));
  }
  return true;
}

async function shutdown() {
  stopping = true;
  await store.close();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

console.log(`Sync worker started: ${workerId}`);
while (!stopping) {
  const processed = await processNextJob();
  if (!processed) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}
