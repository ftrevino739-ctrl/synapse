alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists look jsonb not null default '{}'::jsonb;
