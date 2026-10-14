import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Account password hashing. Each user's password is stored as a salted
// scrypt digest in `users.password_hash`; the plaintext is never stored.

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string, salt = randomBytes(16)): string {
  const derived = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString(
    "hex"
  )}$${derived.toString("hex")}`;
}

export function verifyPassword(candidate: string, stored: string): boolean {
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

// Checked against when the email isn't registered, so a login attempt for an
// unknown email costs the same scrypt work as one for a real account and
// response timing doesn't reveal which emails exist.
const DUMMY_HASH = hashPassword("stits-dummy-password");

export function verifyPasswordOrDummy(candidate: string, stored: string | undefined): boolean {
  const ok = verifyPassword(candidate, stored ?? DUMMY_HASH);
  return stored !== undefined && ok;
}
