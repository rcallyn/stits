import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// App-login password verification.
//
// Preferred: set APP_PASSWORD_HASH to a scrypt digest produced by
// `node scripts/hash-password.mjs '<password>'`. The plaintext never lives in
// the environment.
//
// Fallback: if APP_PASSWORD_HASH is unset, APP_PASSWORD (plaintext) is still
// accepted so existing deployments keep working until they migrate.

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

export function hashPassword(password: string, salt = randomBytes(16)): string {
  const derived = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString(
    "hex"
  )}$${derived.toString("hex")}`;
}

function verifyAgainstHash(candidate: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!N || !r || !p) return false;

  const expected = Buffer.from(hashHex, "hex");
  let derived: Buffer;
  try {
    derived = scryptSync(candidate, Buffer.from(saltHex, "hex"), expected.length, { N, r, p });
  } catch {
    return false;
  }
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function verifyPlaintext(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b); // keep the timing profile close to the equal-length path
    return false;
  }
  return timingSafeEqual(a, b);
}

export function verifyAppPassword(candidate: string): boolean {
  const hash = process.env.APP_PASSWORD_HASH;
  if (hash) return verifyAgainstHash(candidate, hash);
  return verifyPlaintext(candidate, process.env.APP_PASSWORD ?? "");
}
