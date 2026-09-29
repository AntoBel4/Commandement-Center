-- Private per-household pairing, preferences and delivery receipts. No bot token or event text.
create table telegram_state (
  family_id uuid primary key references families(id),
  data jsonb not null default '{"links":{},"pairs":{},"deliveries":{},"offset":0}'::jsonb
);
