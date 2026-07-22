-- Turns sync_logs into a durable, retryable synchronization job queue.

alter table sync_logs
  add column if not exists attempts integer not null default 0,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by varchar(100),
  add column if not exists completed_at timestamptz;

create index if not exists sync_logs_pending_jobs_idx
  on sync_logs (status, next_attempt_at, created_at)
  where status in ('pending', 'retry');
