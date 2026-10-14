// Signed-cookie helpers for the email/password (+ optional Pushover push)
// login flow. Uses Web
// Crypto (`crypto.subtle`) rather than Node's `crypto` module so the exact
// same code works in both middleware (Edge runtime) and API routes (Node
// runtime) without a runtime mismatch.

export const SESSION_COOKIE_NAME = "stits_session";
export const PENDING_COOKIE_NAME = "stits_pending_2fa";

// 400 days is the practical ceiling most browsers (Chrome, Safari) enforce
// on cookie lifetime regardless of what maxAge asks for — this is as close
// to "remember this device forever" as a cookie can actually get.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

// `secure` cookies are silently refused by browsers on any plain-HTTP
// origin that isn't localhost — e.g. testing from a phone against the
// `http://192.168.x.x:3000` LAN address `next dev` prints. Only require it
// once this is actually deployed behind HTTPS.
export const SECURE_COOKIES = process.env.NODE_ENV === "production";

// Session payloads are `user:<uuid>:<session version>`. The proxy only
// checks the signature (it runs without a database); API routes re-check
// that the user is still active and that the version still matches
// `users.session_version` (lib/auth.ts). Removing a user, or bumping their
// version on a password change, therefore revokes every existing session.
const SESSION_RE =
  /^user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{1,9})$/i;
const PENDING_TTL_MS = 5 * 60 * 1000;

const encoder = new TextEncoder();

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0) return null;
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

// Compares two strings without bailing out at the first differing byte, so
// response time doesn't reveal how much of a guessed code was correct.
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${bytesToHex(signature)}`;
}

// Returns the verified payload, or null if the signature is missing/invalid.
async function verify(token: string, secret: string): Promise<string | null> {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const payload = token.slice(0, dotIndex);
  const sigBytes = hexToBytes(token.slice(dotIndex + 1));
  if (!sigBytes) return null;
  const key = await getKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
  return valid ? payload : null;
}

export type SessionClaims = { userId: string; version: number };

export async function createSessionCookieValue(userId: string, version: number): Promise<string> {
  return sign(`user:${userId}:${version}`, requireSecret());
}

/** The signed-in user's id and session version, or null if the cookie is missing or forged. */
export async function getSessionClaims(value: string | undefined): Promise<SessionClaims | null> {
  if (!value) return null;
  const payload = await verify(value, requireSecret());
  const match = payload ? SESSION_RE.exec(payload) : null;
  return match ? { userId: match[1], version: Number(match[2]) } : null;
}

export async function isValidSessionCookie(value: string | undefined): Promise<boolean> {
  return (await getSessionClaims(value)) !== null;
}

// The pending cookie goes to the same client that just entered the
// password, so it must not reveal the code: it's signed, not encrypted. It
// carries only an HMAC of the code, which can't be brute-forced offline
// without SESSION_SECRET.
async function codeTag(userId: string, code: string, expiresAt: number): Promise<string> {
  const key = await getKey(requireSecret());
  const tag = await crypto.subtle.sign("HMAC", key, encoder.encode(`2fa:${userId}:${expiresAt}:${code}`));
  return bytesToHex(tag);
}

export async function createPendingCookieValue(userId: string, code: string): Promise<string> {
  const expiresAt = Date.now() + PENDING_TTL_MS;
  const payload = JSON.stringify({ userId, tag: await codeTag(userId, code, expiresAt), expiresAt });
  return sign(payload, requireSecret());
}

/** The user id the pending 2FA cookie was issued for, if `submittedCode` matches and hasn't expired. */
export async function verifyPendingCookieValue(
  value: string | undefined,
  submittedCode: string
): Promise<string | null> {
  if (!value) return null;
  const payload = await verify(value, requireSecret());
  if (!payload) return null;
  try {
    const { userId, tag, expiresAt } = JSON.parse(payload) as {
      userId: unknown;
      tag: unknown;
      expiresAt: unknown;
    };
    if (typeof userId !== "string" || typeof tag !== "string" || typeof expiresAt !== "number") {
      return null;
    }
    if (Date.now() >= expiresAt) return null;
    return timingSafeEqual(tag, await codeTag(userId, submittedCode, expiresAt)) ? userId : null;
  } catch {
    return null;
  }
}
