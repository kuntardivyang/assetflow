/**
 * Minimal in-memory fixed-window rate limiter for auth endpoints.
 *
 * Per-process only — perfect for a single-instance demo. In a multi-instance
 * deploy, swap the Map for a shared store (Redis / Upstash) with the same API.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Client IP for rate-limit keys.
 *
 * `x-forwarded-for` is only trusted when the app is explicitly deployed behind a
 * known proxy (`TRUST_PROXY=true`) — otherwise a client could spoof the header
 * to mint a fresh bucket per request and defeat the throttle. A Next.js Request
 * doesn't expose the raw socket address, so without a trusted proxy we fall back
 * to a single shared bucket (safe: spoofing can't escape it).
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "true") {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return "shared";
}
