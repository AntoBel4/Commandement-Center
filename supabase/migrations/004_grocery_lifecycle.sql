-- Additive migration: retains old records; new installations start empty.
alter table grocery_items
  add column if not exists status varchar(20) not null default 'open',
  add column if not exists available_on date not null default current_date,
  add column if not exists urgent boolean not null default false,
  add column if not exists created_by uuid,
  add column if not exists assigned_to uuid,
  add column if not exists version integer not null default 1;

update grocery_items set status = 'purchased' where purchased = true and status = 'open';
alter table grocery_items add constraint grocery_status_check
  check (status in ('open', 'purchased', 'cancelled'));
alter table grocery_items add constraint grocery_status_purchased_check
  check (purchased = (status = 'purchased'));
alter table grocery_items add constraint grocery_version_check check (version > 0);

create table grocery_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),
  grocery_id uuid not null references grocery_items(id),
  actor_id uuid,
  action varchar(30) not null,
  before_data jsonb,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
create index grocery_history_item_idx on grocery_history (family_id, grocery_id, created_at);

create table grocery_requests (
  family_id uuid not null references families(id),
  request_key varchar(128) not null,
  request_hash varchar(64) not null,
  response_data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (family_id, request_key)
);
create index grocery_open_available_idx on grocery_items (family_id, status, available_on);
