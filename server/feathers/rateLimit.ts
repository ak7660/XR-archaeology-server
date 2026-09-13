/**
 * Small in-memory rate limiter for sign-in, sign-up and email-code endpoints.
 *
 * Counts live in this process only, which is enough while the server runs as a
 * single Railway instance. A restart clears them - acceptable for limits whose
 * job is to stop password guessing and email flooding, not to bill anyone.
 */
import * as errors from "@feathersjs/errors";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Records one attempt for `key` and reports whether it is still within `limit` per `windowMs`. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Like `allow`, but throws a 429 with a message the app can show as-is. */
export function enforce(key: string, limit: number, windowMs: number, message = "Too many attempts. Please wait a few minutes and try again.") {
  if (!allow(key, limit, windowMs)) throw new errors.TooManyRequests(message);
}

/** Forget a key, e.g. after a successful sign-in. */
export function reset(key: string) {
  buckets.delete(key);
}

/** The caller's address. Railway's proxy puts the client first in X-Forwarded-For. */
export function clientIp(params: any): string {
  const raw = params?.ip || params?.headers?.["x-forwarded-for"] || "";
  return String(Array.isArray(raw) ? raw[0] : raw).split(",")[0].trim() || "unknown";
}

// Drop expired buckets now and then so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}, 10 * 60 * 1000).unref();

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
