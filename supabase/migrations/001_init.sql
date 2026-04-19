create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  external_id varchar(255),
  title varchar(255) not null,
  description text,
  event_type varchar(50),
  person varchar(100),
  date date not null,
  time time,
  location varchar(255),
  notes text,
  source varchar(20) default 'alexa',
  telegram_message_id integer,
  notion_page_id varchar(255),
  status varchar(20) default 'active',
  sync_google boolean default false,
  sync_notion boolean default false,
  sync_telegram boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists grocery_items (
  id uuid primary key default gen_random_uuid(),
  external_id varchar(255),
  name varchar(255) not null,
  quantity decimal(10,2),
  unit varchar(50),
  category varchar(100),
  purchased boolean default false,
  purchased_at timestamptz,
  purchased_by varchar(100),
  source varchar(20) default 'alexa',
  telegram_message_id integer,
  notion_page_id varchar(255),
  sync_status varchar(20) default 'pending',
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sync_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type varchar(20) not null,
  entity_id uuid not null,
  service varchar(50) not null,
  action varchar(20) not null,
  status varchar(20) not null,
  error_message text,
  response_data jsonb,
  created_at timestamptz default now()
);

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  telegram_chat_id bigint,
  google_calendar_id varchar(255),
  notion_database_id varchar(255),
  grocery_list_id varchar(255),
  alexa_user_id varchar(255),
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
