-- Proposals and both approvals stay in Maison until Google confirms creation.
create table calendar_proposals (
  id uuid primary key,
  family_id uuid not null references families(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index calendar_proposals_family on calendar_proposals(family_id, created_at);
