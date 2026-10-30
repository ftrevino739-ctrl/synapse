-- Synapse: public usernames, friend graph, chat, and saved block worlds.
-- Birth dates stay on the owner's row and are never selected for other players.

create table if not exists profiles (
  user_id        text primary key,
  username       text not null,
  username_lower text not null unique,
  birth_date     date not null,
  created_at     timestamptz not null default now()
);

create table if not exists friend_requests (
  id           serial primary key,
  from_user_id text not null,
  to_user_id   text not null,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  constraint friend_requests_status_chk check (status in ('pending', 'accepted')),
  constraint friend_requests_distinct_chk check (from_user_id <> to_user_id),
  constraint friend_requests_pair_uq unique (from_user_id, to_user_id)
);

create index if not exists friend_requests_to_idx on friend_requests (to_user_id, status);
create index if not exists friend_requests_from_idx on friend_requests (from_user_id, status);

create table if not exists messages (
  id           serial primary key,
  from_user_id text not null,
  to_user_id   text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists messages_pair_idx on messages (from_user_id, to_user_id, id);

create table if not exists experiences (
  id         serial primary key,
  owner_id   text not null,
  title      text not null,
  blocks     jsonb not null default '[]'::jsonb,
  script     text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists experiences_owner_idx on experiences (owner_id, updated_at desc);
