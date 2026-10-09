import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/** Anonymous IDs are UUIDs: no separators, so `<id>.<signature>` splits unambiguously. */
const ID_PATTERN = /^[0-9a-f-]{36}$/;

export function newAnonId(): string {
  return randomUUID();
}

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(`anon-cookie:${id}`).digest("base64url");
}

/** The cookie value: `<id>.<signature>`. */
export function signAnonId(id: string, secret: string): string {
  return `${id}.${sign(id, secret)}`;
}

/** The anonymous ID inside a cookie value, or null if it is missing, malformed or forged. */
export function verifyAnonCookie(value: string | undefined, secret: string): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [id, signature] = parts;
  if (!ID_PATTERN.test(id)) return null;
  const expected = Buffer.from(sign(id, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return id;
}
