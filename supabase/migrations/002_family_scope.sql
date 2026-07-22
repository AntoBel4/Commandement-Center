-- PostgreSQL standard family scope.
-- Authentication and authorization are enforced by the Fastify API.
-- family_id remains nullable during the data migration period.

create table if not exists family_members (
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null,
  role varchar(20) not null default 'member',
  created_at timestamptz not null default now(),
  primary key (family_id, user_id),
  constraint family_members_role_check check (role in ('owner', 'member'))
);

alter table events
  add column if not exists family_id uuid references families(id) on delete cascade;

alter table grocery_items
  add column if not exists family_id uuid references families(id) on delete cascade;

alter table sync_logs
  add column if not exists family_id uuid references families(id) on delete cascade;

create index if not exists events_family_date_idx
  on events (family_id, date, time);

create index if not exists grocery_items_family_purchased_idx
  on grocery_items (family_id, purchased, created_at);

create index if not exists sync_logs_family_created_idx
  on sync_logs (family_id, created_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists families_set_updated_at on families;
create trigger families_set_updated_at
before update on families
for each row execute function set_updated_at();

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
before update on events
for each row execute function set_updated_at();

drop trigger if exists grocery_items_set_updated_at on grocery_items;
create trigger grocery_items_set_updated_at
before update on grocery_items
for each row execute function set_updated_at();
