// Signed-cookie helpers for the password + Pushover-push login flow. Uses Web
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

const SESSION_PAYLOAD = "authenticated";
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

export async function createSessionCookieValue(): Promise<string> {
  return sign(SESSION_PAYLOAD, requireSecret());
}

export async function isValidSessionCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const payload = await verify(value, requireSecret());
  return payload === SESSION_PAYLOAD;
}

export async function createPendingCookieValue(code: string): Promise<string> {
  const payload = JSON.stringify({ code, expiresAt: Date.now() + PENDING_TTL_MS });
  return sign(payload, requireSecret());
}

export async function verifyPendingCookieValue(
  value: string | undefined,
  submittedCode: string
): Promise<boolean> {
  if (!value) return false;
  const payload = await verify(value, requireSecret());
  if (!payload) return false;
  try {
    const { code, expiresAt } = JSON.parse(payload) as { code: string; expiresAt: number };
    return code === submittedCode && Date.now() < expiresAt;
  } catch {
    return false;
  }
}
