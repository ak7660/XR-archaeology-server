/**
 * One-time 6-digit codes for confirming an email address and resetting a password.
 *
 * Only a bcrypt hash of each code is stored, with an expiry and an attempt
 * counter. Six digits are guessable offline, so the real protection is the
 * attempt limit, the short expiry and the per-email rate limits in the services.
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";

export const VERIFY_MINUTES = 60;
export const RESET_MINUTES = 30;
/** Wrong guesses allowed before a code is thrown away and a new one is needed. */
export const MAX_CODE_ATTEMPTS = 5;

export function newCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 8);
}

export type CodeCheck = "ok" | "wrong" | "expired" | "missing" | "locked";

/** Compares a typed code with the stored hash, honouring expiry and attempts. */
export async function checkCode(
  typed: unknown,
  stored: { hash?: string | null; expires?: Date | string | null; attempts?: number | null }
): Promise<CodeCheck> {
  if (!stored.hash || !stored.expires) return "missing";
  if ((stored.attempts || 0) >= MAX_CODE_ATTEMPTS) return "locked";
  if (new Date(stored.expires).getTime() < Date.now()) return "expired";
  const clean = String(typed ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return "wrong";
  return (await bcrypt.compare(clean, stored.hash)) ? "ok" : "wrong";
}

export function expiresIn(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
