/**
 * Minimal single-admin auth for the MVP: credentials in env vars and an
 * HMAC-signed, httpOnly session cookie. Uses Web Crypto so it runs both in
 * middleware (edge) and in server actions (node).
 */
export const ADMIN_COOKIE = "tetoca_admin";
const SESSION_HOURS = 12;

const encoder = new TextEncoder();

// Edge-compatible base64url (no Buffer in middleware).
function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(sig));
}

function secret(): string | undefined {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= 32 ? s : undefined;
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD && secret());
}

/** Constant-time comparison by comparing HMACs of both values. */
async function safeEqual(a: string, b: string, key: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([hmac(a, key), hmac(b, key)]);
  let diff = ha.length ^ hb.length;
  for (let i = 0; i < Math.min(ha.length, hb.length); i++)
    diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

export async function checkCredentials(user: string, password: string): Promise<boolean> {
  const key = secret();
  if (!adminConfigured() || !key) return false;
  const okUser = await safeEqual(user, process.env.ADMIN_USER!, key);
  const okPass = await safeEqual(password, process.env.ADMIN_PASSWORD!, key);
  return okUser && okPass;
}

export async function createSession(user: string, now = Date.now()): Promise<string> {
  const key = secret();
  if (!key) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
  const payload = `${toBase64Url(encoder.encode(user))}.${now + SESSION_HOURS * 3600_000}`;
  return `${payload}.${await hmac(payload, key)}`;
}

/** Returns the admin user if the session token is valid and not expired. */
export async function verifySession(token: string | undefined, now = Date.now()) {
  const key = secret();
  if (!token || !key) return undefined;
  const [user, expires, sig] = token.split(".");
  if (!user || !expires || !sig) return undefined;
  if (!(await safeEqual(sig, await hmac(`${user}.${expires}`, key), key))) return undefined;
  if (Number(expires) < now) return undefined;
  try {
    return fromBase64Url(user);
  } catch {
    return undefined;
  }
}

export const SESSION_MAX_AGE = SESSION_HOURS * 3600;
