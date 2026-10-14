// Usage: node --env-file=.env.local scripts/migrate-multi-user.mjs
//
// Upgrades a single-user stits database to multi-user, in one transaction:
// creates the `users` table, creates the owner's account (an active admin)
// and assigns every existing todo, event, setting and Canvas dismissal to it.
// Safe to re-run; each step is skipped once it's done. Also works on a fresh
// database after schema.sql, to create the first admin.
//
// Reads:
//   DATABASE_URL        the database to migrate
//   OWNER_EMAIL         the owner's login email
//   APP_PASSWORD_HASH   the owner's password hash (or APP_PASSWORD, hashed here)
//   PUSHOVER_USER_KEY   optional; the owner's Pushover key, for 2FA + digest

import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

const { DATABASE_URL, OWNER_EMAIL, APP_PASSWORD_HASH, APP_PASSWORD, PUSHOVER_USER_KEY } = process.env;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!DATABASE_URL) fail("DATABASE_URL is not set.");
if (!OWNER_EMAIL) fail("OWNER_EMAIL is not set — it becomes the owner's login email.");
if (!APP_PASSWORD_HASH && !APP_PASSWORD) fail("Set APP_PASSWORD_HASH (or APP_PASSWORD) for the owner's password.");

function hashPassword(password) {
  const params = { N: 16384, r: 8, p: 1 };
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const email = OWNER_EMAIL.trim().toLowerCase();
const passwordHash = APP_PASSWORD_HASH || hashPassword(APP_PASSWORD);
// A hash mangled by the shell (an unquoted `$` expands, leaving just
// "scrypt") would lock the only admin out for good, so check its shape.
if (!/^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(passwordHash)) {
  fail("APP_PASSWORD_HASH isn't a complete scrypt hash. Quote it in single quotes in .env.local.");
}
const sql = postgres(DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });

async function hasColumn(tx, table, column) {
  const [row] = await tx`
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = ${table} and column_name = ${column}
  `;
  return Boolean(row);
}

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(`
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
      alter table users add column if not exists session_version int not null default 1;
      alter table users enable row level security;
      revoke all on users from anon, authenticated;
    `);

    let [owner] = await tx`select id from users where email = ${email}`;
    if (!owner) {
      [owner] = await tx`
        insert into users (email, password_hash, status, is_admin, pushover_user_key)
        values (${email}, ${passwordHash}, 'active', true, ${PUSHOVER_USER_KEY || null})
        returning id
      `;
      console.log(`Created owner account ${email}.`);
    } else {
      console.log(`Owner account ${email} already exists.`);
    }
    const ownerId = owner.id;

    for (const table of ["todos", "schedule_events"]) {
      if (await hasColumn(tx, table, "user_id")) continue;
      await tx.unsafe(`alter table ${table} add column user_id uuid references users(id) on delete cascade`);
      await tx.unsafe(`update ${table} set user_id = $1`, [ownerId]);
      await tx.unsafe(`alter table ${table} alter column user_id set not null`);
      await tx.unsafe(`create index if not exists ${table}_user_id_idx on ${table} (user_id)`);
      console.log(`Assigned existing ${table} to the owner.`);
    }

    if (!(await hasColumn(tx, "settings", "user_id"))) {
      await tx.unsafe(`
        alter table settings add column user_id uuid references users(id) on delete cascade;
        alter table settings drop constraint if exists settings_singleton;
        alter table settings drop constraint if exists settings_pkey;
      `);
      await tx.unsafe(`update settings set user_id = $1 where id = 1`, [ownerId]);
      await tx.unsafe(`
        delete from settings where user_id is null;
        alter table settings drop column id;
        alter table settings add primary key (user_id);
      `);
      console.log("Moved settings to the owner.");
    }
    await tx`insert into settings (user_id) values (${ownerId}) on conflict (user_id) do nothing`;

    if (!(await hasColumn(tx, "canvas_dismissed", "user_id"))) {
      await tx.unsafe(`alter table canvas_dismissed add column user_id uuid references users(id) on delete cascade`);
      await tx.unsafe(`update canvas_dismissed set user_id = $1`, [ownerId]);
      await tx.unsafe(`
        alter table canvas_dismissed alter column user_id set not null;
        alter table canvas_dismissed drop constraint if exists canvas_dismissed_pkey;
        alter table canvas_dismissed add primary key (user_id, canvas_id, scope);
      `);
      console.log("Assigned Canvas dismissals to the owner.");
    }
  });
  console.log("Done.");
} catch (err) {
  console.error("Migration failed; nothing was changed.");
  console.error(err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
