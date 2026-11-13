-- =====================================================================
-- Social Working Manager — Complete Idempotent Setup (001 + 002 + Backfill)
-- Open Supabase Dashboard -> SQL Editor -> New query, paste this file, and click Run.
-- Safe to run multiple times.
-- =====================================================================

-- =====================================================================
-- PART 1: 001_init.sql — Initial Schema, Triggers & Row Level Security
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type platform_t as enum ('LINKEDIN','X_TWITTER','BLOG');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tone_t as enum ('PROFESSIONAL','CASUAL','INFORMATIVE','FRIENDLY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type publish_mode_t as enum ('DIRECT_API','TRANSFER_REDIRECT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type connection_state_t as enum ('DISCONNECTED','CONNECTING','CONNECTED','TOKEN_EXPIRED','AUTH_FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type calendar_status_t as enum ('PLANNED','PUBLISHED','CANCELLED');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  user_id          uuid generated always as (id) stored,
  full_name        text,
  avatar_url       text,
  default_platform platform_t not null default 'LINKEDIN',
  default_tone     tone_t not null default 'PROFESSIONAL',
  blog_cms_url     text,
  created_at       timestamptz not null default now()
);

create table if not exists public.templates (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  structure_text   text not null check (char_length(structure_text) between 1 and 5000),
  default_platform platform_t not null default 'LINKEDIN',
  default_tone     tone_t not null default 'PROFESSIONAL',
  created_at       timestamptz not null default now()
);

create table if not exists public.content_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  input_text  text not null check (char_length(input_text) between 1 and 5000),
  platform    platform_t not null,
  tone        tone_t not null,
  template_id uuid references public.templates(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- History of every generation (FR-36)
create table if not exists public.generated_content (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  request_id   uuid not null references public.content_requests(id) on delete cascade,
  raw_body     text not null,
  refined_body text not null,
  platform     platform_t not null,
  tone         tone_t not null,
  version      int not null default 1,
  created_at   timestamptz not null default now()
);

create table if not exists public.drafts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  content_id  uuid references public.generated_content(id) on delete set null,
  title       text not null check (char_length(title) between 1 and 200),
  body        text not null check (char_length(body) <= 50000),
  platform    platform_t not null,
  tone        tone_t not null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table if not exists public.platform_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  platform         platform_t not null,
  status           connection_state_t not null default 'DISCONNECTED',
  access_token_enc text,           -- AES-256-GCM, server-side only, never returned to the client
  expires_at       timestamptz,
  external_account text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, platform)
);

create table if not exists public.publish_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  content_id       uuid references public.generated_content(id) on delete set null,
  draft_id         uuid references public.drafts(id) on delete set null,
  connection_id    uuid references public.platform_connections(id) on delete set null,
  platform         platform_t not null,
  mode             publish_mode_t not null,
  status           text not null,
  external_post_id text,
  external_url     text,
  error            text,
  published_at     timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists public.calendar_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  draft_id      uuid references public.drafts(id) on delete set null,
  title         text not null check (char_length(title) between 1 and 200),
  platform      platform_t not null,
  scheduled_for timestamptz not null,
  status        calendar_status_t not null default 'PLANNED',
  created_at    timestamptz not null default now()
);

-- ---------- Indexes for list queries ----------
create index if not exists templates_user_created_idx        on public.templates (user_id, created_at desc);
create index if not exists content_requests_user_created_idx on public.content_requests (user_id, created_at desc);
create index if not exists generated_content_user_created_idx on public.generated_content (user_id, created_at desc);
create index if not exists drafts_user_created_idx           on public.drafts (user_id, created_at desc);
create index if not exists drafts_user_updated_idx           on public.drafts (user_id, updated_at desc);
create index if not exists publish_jobs_user_created_idx     on public.publish_jobs (user_id, created_at desc);
create index if not exists calendar_entries_user_sched_idx   on public.calendar_entries (user_id, scheduled_for);
create index if not exists calendar_entries_user_created_idx on public.calendar_entries (user_id, created_at desc);
create index if not exists platform_connections_user_idx     on public.platform_connections (user_id, created_at desc);

-- ---------- updated_at triggers ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists drafts_touch on public.drafts;
create trigger drafts_touch before update on public.drafts
  for each row execute function public.touch_updated_at();

drop trigger if exists platform_connections_touch on public.platform_connections;
create trigger platform_connections_touch before update on public.platform_connections
  for each row execute function public.touch_updated_at();

-- ---------- Starter templates + profile on signup ----------
create or replace function public.seed_starter_templates(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.templates (user_id, name, structure_text, default_platform, default_tone) values
  (uid, 'Project / Achievement Update',
   E'Project: {project}\nWhat I built or achieved: {achievement}\nThe challenge: {challenge}\nWhat I learned: {lesson}\nThanks to: {people}',
   'LINKEDIN', 'PROFESSIONAL'),
  (uid, 'Internship Learning Post',
   E'Company / team: {company}\nRole: {role}\nThree things I learned: {lesson_1}; {lesson_2}; {lesson_3}\nA moment that stood out: {moment}\nWhat''s next: {next_step}',
   'LINKEDIN', 'FRIENDLY'),
  (uid, 'Product Launch',
   E'Product: {product}\nWho it is for: {audience}\nProblem it solves: {problem}\nKey features: {features}\nWhere to try it: {link}',
   'X_TWITTER', 'CASUAL'),
  (uid, 'Thought Leadership',
   E'Topic: {topic}\nMy point of view: {opinion}\nEvidence or experience: {evidence}\nCommon misconception: {misconception}\nQuestion for readers: {question}',
   'BLOG', 'INFORMATIVE');
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  perform public.seed_starter_templates(new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the trigger (running as definer) may call the seeding helper.
revoke all on function public.seed_starter_templates(uuid) from public, anon, authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles             enable row level security;
alter table public.templates            enable row level security;
alter table public.content_requests     enable row level security;
alter table public.generated_content    enable row level security;
alter table public.drafts               enable row level security;
alter table public.platform_connections enable row level security;
alter table public.publish_jobs         enable row level security;
alter table public.calendar_entries     enable row level security;

-- profiles: owner = id
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete on public.profiles for delete using (id = auth.uid());

-- Generic owner policies for all user_id tables
do $$
declare t text;
begin
  foreach t in array array['templates','content_requests','generated_content','drafts',
                           'platform_connections','publish_jobs','calendar_entries']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select using (user_id = auth.uid())', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (user_id = auth.uid())', t);
    execute format('create policy %1$s_update on public.%1$s for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- =====================================================================
-- PART 2: 002_protect_tokens.sql — Protect Encrypted OAuth Tokens
-- =====================================================================

-- 1. Revoke table-level SELECT on platform_connections from client roles.
revoke select on public.platform_connections from anon, authenticated;

-- 2. Re-grant SELECT only on safe status/metadata columns (excluding
--    access_token_enc and any refresh token columns) to authenticated.
grant select (
  id,
  user_id,
  platform,
  status,
  expires_at,
  external_account,
  created_at,
  updated_at
) on public.platform_connections to authenticated;

-- =====================================================================
-- PART 3: Idempotent Backfill for Existing auth.users
-- 1. Insert a profiles row for every auth.users row that has none.
-- 2. Run seed_starter_templates(id) for every user that has zero templates.
-- =====================================================================

insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

do $$
declare
  u record;
begin
  for u in
    select au.id
    from auth.users au
    where not exists (
      select 1 from public.templates t where t.user_id = au.id
    )
  loop
    perform public.seed_starter_templates(u.id);
  end loop;
end $$;

-- =====================================================================
-- PART 4: 003_x_refresh_token.sql — Encrypted OAuth Refresh Token
-- =====================================================================

alter table public.platform_connections
  add column if not exists refresh_token_enc text;

-- Ensure table-level SELECT remains revoked and refresh_token_enc is never granted
-- to anon or authenticated (only safe metadata columns are granted to authenticated).
revoke select on public.platform_connections from anon, authenticated;

grant select (
  id,
  user_id,
  platform,
  status,
  expires_at,
  external_account,
  created_at,
  updated_at
) on public.platform_connections to authenticated;
