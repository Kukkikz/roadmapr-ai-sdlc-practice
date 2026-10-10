import { createHash, randomBytes } from "node:crypto";

// 32 random bytes in base64url is always 43 characters.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * A new secret for an access link or a Session: 256 random bits, URL-safe. Only its hash is
 * ever stored (G4); the raw value exists in the link or cookie the holder keeps.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Whether `value` could be a token we issued. Cheap check before touching the database. */
export function isTokenShape(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/**
 * What the database stores for a token. Plain SHA-256 is enough because tokens are long and
 * random (nothing to guess or brute-force), and it keeps links and Sessions valid when
 * `SESSION_SECRET` is rotated. Lookup is by this hash under a unique index, so there is no
 * secret comparison that could leak timing.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
