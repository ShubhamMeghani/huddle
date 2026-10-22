-- Huddle core schema (SPEC §4.1)

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  google_sub text unique,
  email text,
  name text,
  image text,
  created_at timestamptz not null default now()
);

create table if not exists identities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('guest', 'user')),
  display_name text not null,
  device_token_hash text unique,
  user_id uuid unique references users(id),
  merged_into uuid references identities(id),
  created_at timestamptz not null default now()
);

create table if not exists crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_token text not null unique,
  created_by uuid references identities(id),
  created_at timestamptz not null default now()
);

create table if not exists crew_members (
  crew_id uuid not null references crews(id) on delete cascade,
  identity_id uuid not null references identities(id),
  joined_at timestamptz not null default now(),
  primary key (crew_id, identity_id)
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code char(4) not null,
  crew_id uuid references crews(id),
  is_demo boolean not null default false,
  state jsonb not null,
  version int not null default 0,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz
);
-- A code is unique among rooms that have not been retired; expired rooms are retired lazily.
create unique index if not exists rooms_code_live on rooms (code) where ended_at is null;

create table if not exists room_actions (
  room_id uuid not null references rooms(id) on delete cascade,
  action_id uuid not null,
  identity_id uuid,
  type text not null,
  result jsonb not null,
  version_after int not null,
  created_at timestamptz not null default now(),
  primary key (room_id, action_id)
);

create table if not exists presence (
  room_id uuid not null references rooms(id) on delete cascade,
  identity_id uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, identity_id)
);

create table if not exists strokes (
  room_id uuid not null references rooms(id) on delete cascade,
  turn_id text not null,
  seq int not null,
  ops jsonb not null,
  created_at timestamptz not null default now(),
  primary key (room_id, turn_id, seq)
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  crew_id uuid references crews(id),
  game_no int not null,
  game_type text not null,
  settings jsonb not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  unique (room_id, game_no)
);

create table if not exists game_results (
  game_id uuid not null references games(id) on delete cascade,
  identity_id uuid not null references identities(id),
  display_name text not null,
  team text,
  rank int not null,
  score int not null,
  placement_points numeric not null,
  stats jsonb not null default '{}'::jsonb,
  primary key (game_id, identity_id)
);
create index if not exists game_results_identity on game_results (identity_id);

create table if not exists nights (
  room_id uuid primary key references rooms(id),
  crew_id uuid references crews(id),
  date_ist date not null,
  awards jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists ratings (
  identity_id uuid not null references identities(id),
  game_type text not null,
  rating double precision not null default 1000,
  games int not null default 0,
  primary key (identity_id, game_type)
);

create table if not exists question_reports (
  question_id text not null,
  identity_id uuid not null references identities(id),
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (question_id, identity_id)
);

create table if not exists place_suggestions (
  id bigserial primary key,
  name_normalized text not null,
  room_id uuid references rooms(id),
  accepted boolean not null,
  created_at timestamptz not null default now()
);
