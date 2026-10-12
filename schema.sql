-- stits database schema (Supabase Postgres)
-- Run once against a fresh database. Single-tenant: no user_id columns —
-- the whole app is gated by one shared login, not per-user accounts.

create extension if not exists pgcrypto;

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  done boolean not null default false,
  due_date date,
  category text,
  priority text,
  subtasks jsonb,
  completed_at timestamptz,
  canvas_id text
);

create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  end_date date,
  time text not null default '',
  end_time text,
  todo_id uuid references todos(id) on delete cascade,
  category text,
  done boolean,
  notes jsonb,
  is_note_event boolean,
  recurrence jsonb,
  canvas_id text
);

create table if not exists settings (
  id int primary key default 1,
  category_colors jsonb not null default '{}',
  category_labels jsonb not null default '{}',
  category_order jsonb not null default '[]',
  canvas_feed_url text,
  canvas_last_synced_at timestamptz,
  -- Session cookies issued before this moment are rejected ("log out everywhere").
  sessions_valid_after timestamptz,
  constraint settings_singleton check (id = 1)
);

alter table settings add column if not exists sessions_valid_after timestamptz;

insert into settings (id) values (1) on conflict (id) do nothing;

-- Tracks failed login/2FA attempts per IP to throttle brute-forcing. `scope`
-- separates the password step from the 2FA step since they have different
-- limits.
create table if not exists login_attempts (
  scope text not null,
  ip text not null,
  attempts int not null default 1,
  window_start timestamptz not null default now(),
  primary key (scope, ip)
);

-- Canvas assignments the user deleted, so the daily sync doesn't re-add
-- them. `scope` is 'todo' (the todo was deleted) or 'event' (only its
-- calendar entry was).
create table if not exists canvas_dismissed (
  canvas_id text not null,
  scope text not null check (scope in ('todo', 'event')),
  dismissed_at timestamptz not null default now(),
  primary key (canvas_id, scope)
);

-- This app never uses Supabase's client SDK or its auto-generated REST API
-- (PostgREST) — every query goes through a direct Postgres connection from
-- the Next.js server, authenticated by this app's own password+2FA login.
-- Supabase still exposes every table to that REST API by default though,
-- using the `anon`/`authenticated` roles, regardless of whether the app
-- code ever calls it. Enabling RLS with no policies denies those roles
-- entirely; the server's own connection (the `postgres` role, which has
-- BYPASSRLS) is unaffected. Revoking the default grants closes the same
-- gap at the privilege level too.
do $$
declare
  t text;
begin
  for t in select unnest(array['todos', 'schedule_events', 'settings', 'login_attempts', 'canvas_dismissed'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
