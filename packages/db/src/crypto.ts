import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Encryption at rest for alert subscribers (AES-256-GCM). The key comes from
 * ALERTS_ENCRYPTION_KEY: 32 random bytes, base64 (`openssl rand -base64 32`).
 */
export function encryptionKey(raw = process.env.ALERTS_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("ALERTS_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ALERTS_ENCRYPTION_KEY must be 32 bytes (base64)");
  return key;
}

/** Returns "iv.tag.ciphertext" in base64url. */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string, key: Buffer): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Keyed hash of the normalised email, to find a subscriber without decrypting. */
export function emailHash(email: string, key: Buffer): string {
  return createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex");
}

/** Random URL-safe token; only its SHA-256 is stored. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Stable unsubscribe token for a subscription (HMAC of its id), so the delete
 * link in every email keeps working without storing the token.
 */
export function manageToken(subscriptionId: string, key: Buffer): string {
  return createHmac("sha256", key).update(`manage:${subscriptionId}`).digest("base64url");
}

export function verifyManageToken(subscriptionId: string, token: string, key: Buffer): boolean {
  const expected = Buffer.from(manageToken(subscriptionId, key));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
