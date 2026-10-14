// Usage: node scripts/hash-password.mjs 'your password'
//
// Prints an APP_PASSWORD_HASH=... line for .env.local, which
// scripts/migrate-multi-user.mjs uses as the first admin's password so the
// plaintext never has to be stored anywhere.

import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs '<password>'");
  process.exit(1);
}

const params = { N: 16384, r: 8, p: 1 };
const salt = randomBytes(16);
const derived = scryptSync(password, salt, 64, params);
const hash = `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;

console.log(`APP_PASSWORD_HASH=${hash}`);
