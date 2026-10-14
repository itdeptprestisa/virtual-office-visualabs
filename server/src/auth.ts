import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
export const SESSION_DAYS = 30;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const newToken = () => randomBytes(32).toString("base64url");
export const newId = () => randomBytes(6).toString("hex");
