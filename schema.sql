-- stits database schema (Supabase Postgres)
-- Run once against a fresh database. Single-tenant: no user_id columns —
-- the whole app is gated by one shared login, not per-user accounts.

create extension if not exists pgcrypto;

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
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

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  tag text not null,
  created_at timestamptz not null default now(),
  pinned boolean
);

create table if not exists settings (
  id int primary key default 1,
  category_colors jsonb not null default '{}',
  category_labels jsonb not null default '{}',
  category_order jsonb not null default '[]',
  canvas_feed_url text,
  canvas_last_synced_at timestamptz,
  constraint settings_singleton check (id = 1)
);

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
