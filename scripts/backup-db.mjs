// Usage: node --env-file=.env.local scripts/backup-db.mjs
//
// Read-only: dumps every row of the app's tables to a timestamped JSON file
// in .backups/ (keep it out of git; it holds personal data). Run it before
// any migration so there's something to restore from.

import { mkdirSync, statSync, writeFileSync } from "node:fs";
import postgres from "postgres";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const DATE_OID = 1082; // keep `date` columns as YYYY-MM-DD strings, as the app does
const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  types: { date: { to: DATE_OID, from: [DATE_OID], serialize: (v) => v, parse: (v) => v } },
});

const TABLES = ["users", "todos", "schedule_events", "settings", "canvas_dismissed"];

try {
  const present = new Set(
    (await sql`select table_name from information_schema.tables where table_schema = 'public'`).map(
      (r) => r.table_name
    )
  );
  const takenAt = new Date().toISOString();
  const dump = { takenAt, host: new URL(DATABASE_URL).hostname, tables: {} };
  for (const table of TABLES) {
    if (!present.has(table)) continue;
    dump.tables[table] = await sql`select * from ${sql(table)}`;
    console.log(`${table}: ${dump.tables[table].length} rows`);
  }

  mkdirSync(".backups", { recursive: true });
  const file = `.backups/backup-${takenAt.replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(dump, null, 1));
  console.log(`Saved ${file} (${statSync(file).size} bytes).`);
} catch (err) {
  console.error("Backup failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
