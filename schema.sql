-- stits database schema (Supabase Postgres)
-- Run once against a fresh database. Multi-user: every row of user data
-- carries a user_id, and every query the app makes is scoped to the
-- signed-in user. An existing single-user database is upgraded with
-- scripts/migrate-multi-user.mjs instead.

create extension if not exists pgcrypto;

-- `status` is 'pending' from signup until an admin approves the account;
-- pending users can't sign in. A user with a Pushover key gets push 2FA at
-- login and the 7am digest. Sessions carry `session_version`; bumping it
-- (on a password change) signs out every existing session.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'active')),
  is_admin boolean not null default false,
  pushover_user_key text,
  session_version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
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
create index if not exists todos_user_id_idx on todos (user_id);

create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
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
create index if not exists schedule_events_user_id_idx on schedule_events (user_id);

create table if not exists settings (
  user_id uuid primary key references users(id) on delete cascade,
  category_colors jsonb not null default '{}',
  category_labels jsonb not null default '{}',
  category_order jsonb not null default '[]',
  canvas_feed_url text,
  canvas_last_synced_at timestamptz
);

-- Tracks failed login/2FA attempts and signups per IP to throttle
-- brute-forcing and signup spam. `scope` separates the steps since they
-- have different limits.
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
  user_id uuid not null references users(id) on delete cascade,
  canvas_id text not null,
  scope text not null check (scope in ('todo', 'event')),
  dismissed_at timestamptz not null default now(),
  primary key (user_id, canvas_id, scope)
);

-- This app never uses Supabase's client SDK or its auto-generated REST API
-- (PostgREST) — every query goes through a direct Postgres connection from
-- the Next.js server, authenticated by this app's own login. Supabase still
-- exposes every table to that REST API by default though, using the
-- `anon`/`authenticated` roles, regardless of whether the app code ever
-- calls it. Enabling RLS with no policies denies those roles entirely; the
-- server's own connection (the `postgres` role, which has BYPASSRLS) is
-- unaffected. Revoking the default grants closes the same gap at the
-- privilege level too.
do $$
declare
  t text;
begin
  for t in select unnest(array['users', 'todos', 'schedule_events', 'settings', 'login_attempts', 'canvas_dismissed'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
