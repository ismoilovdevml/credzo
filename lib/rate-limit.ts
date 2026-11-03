import { NextResponse } from "next/server";

/**
 * In-memory sliding-window rate limiter.
 *
 * State lives in the Node.js process, which matches Credzo's single-instance
 * SQLite deployment model. Limiters are cached on globalThis so dev-mode hot
 * reloads do not reset them.
 */

export interface RateLimitStatus {
  limited: boolean;
  /** Seconds until the oldest counted hit leaves the window (0 when not limited). */
  retryAfterSeconds: number;
  remaining: number;
}

export interface RateLimiter {
  /** Reports whether the key is currently over the limit without recording a hit. */
  check(key: string): RateLimitStatus;
  /** Records a hit (e.g. a failed attempt) and returns the resulting status. */
  hit(key: string): RateLimitStatus;
  /** Forgets all hits for the key (e.g. after a successful sign-in). */
  reset(key: string): void;
}

const MAX_TRACKED_KEYS = 10_000;

function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();

  function prune(key: string, now: number): number[] {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length > 0) {
      hits.set(key, recent);
    } else {
      hits.delete(key);
    }
    return recent;
  }

  function sweep(now: number) {
    for (const key of hits.keys()) prune(key, now);
  }

  function status(recent: number[], now: number): RateLimitStatus {
    const limited = recent.length >= limit;
    return {
      limited,
      retryAfterSeconds: limited ? Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) : 0,
      remaining: Math.max(0, limit - recent.length),
    };
  }

  return {
    check(key) {
      const now = Date.now();
      return status(prune(key, now), now);
    },
    hit(key) {
      const now = Date.now();
      if (hits.size >= MAX_TRACKED_KEYS) sweep(now);
      const recent = prune(key, now);
      recent.push(now);
      hits.set(key, recent);
      return status(recent, now);
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

const registry = globalThis as typeof globalThis & {
  __credzoRateLimiters?: Map<string, RateLimiter>;
};

function getLimiter(name: string, limit: number, windowMs: number): RateLimiter {
  registry.__credzoRateLimiters ??= new Map();
  let limiter = registry.__credzoRateLimiters.get(name);
  if (!limiter) {
    limiter = createRateLimiter(limit, windowMs);
    registry.__credzoRateLimiters.set(name, limiter);
  }
  return limiter;
}

/** Failed sign-ins, keyed by ip + username: 5 failures per 10 minutes. */
export const loginLimiter = getLimiter("login", 5, 10 * 60 * 1000);

/** Wrong two-factor codes, keyed by ip: 10 failures per 10 minutes. */
export const twoFactorLimiter = getLimiter("two-factor", 10, 10 * 60 * 1000);

/** Account creation, keyed by ip: 10 sign-ups per hour. */
export const signupLimiter = getLimiter("signup", 10, 60 * 60 * 1000);

/** Re-authentication with the current password (password change, data deletion): keyed by user id. */
export const passwordCheckLimiter = getLimiter("password-check", 5, 10 * 60 * 1000);

/**
 * Number of reverse proxies in front of Credzo that append to X-Forwarded-For
 * (TRUST_PROXY, default 0). Next.js only fills X-Forwarded-For with the socket
 * address when the client did not send one, so without a trusted proxy the
 * header is client-controlled and must not key rate limits.
 */
const TRUSTED_PROXY_HOPS = (() => {
  const hops = Number.parseInt(process.env.TRUST_PROXY ?? "0", 10);
  return Number.isFinite(hops) && hops > 0 ? hops : 0;
})();

/** Whether getRequestIp reflects the real client (a trusted proxy set it). */
export function isClientIpTrusted(): boolean {
  return TRUSTED_PROXY_HOPS > 0;
}

/**
 * Client IP for audit records and rate limits. With TRUST_PROXY=N the address
 * is the N-th X-Forwarded-For entry from the right (the one the outermost
 * trusted proxy saw); without it this is best effort and may be spoofed.
 */
export function getRequestIp(headers: Headers): string {
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  if (hops.length > 0) {
    const index = TRUSTED_PROXY_HOPS > 0 ? Math.max(0, hops.length - TRUSTED_PROXY_HOPS) : hops.length - 1;
    return hops[index];
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Rate-limit key for a request: the client IP when it can be trusted,
 * otherwise the given fallback (e.g. the targeted username or resource) so a
 * spoofed header cannot mint fresh buckets.
 */
export function clientRateKey(headers: Headers, fallback: string): string {
  return isClientIpTrusted() ? getRequestIp(headers) : fallback;
}

export function getRequestUserAgent(headers: Headers): string {
  return headers.get("user-agent")?.slice(0, 512) || "unknown";
}

/** IP and user agent of a request, as recorded in sessions and the audit log. */
export function getRequestMeta(headers: Headers): { ipAddress: string; userAgent: string } {
  return { ipAddress: getRequestIp(headers), userAgent: getRequestUserAgent(headers) };
}

/** 429 response in the API envelope with a Retry-After header. */
export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { success: false, error: "Too many attempts. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" },
    }
  );
}
