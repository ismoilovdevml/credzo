/** Shared request helpers for the public sign-in and sign-up forms. */

export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again.";

export interface AuthResponse<T> {
  ok: boolean;
  status: number;
  /** Parsed JSON body, or null when the body is not JSON. */
  data: (T & { error?: string }) | null;
  /** Retry-After header in seconds (429 responses). */
  retryAfterSeconds: number | null;
}

/**
 * POSTs JSON to an auth endpoint. Rejects only when the request never reached
 * the server (offline, DNS, aborted) so callers can show a network error.
 */
export async function postAuth<T>(url: string, body: unknown): Promise<AuthResponse<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let data: (T & { error?: string }) | null = null;
  try {
    data = (await response.json()) as T & { error?: string };
  } catch {
    data = null;
  }

  const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
  return {
    ok: response.ok,
    status: response.status,
    data,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  };
}

/** "Too many attempts — try again in N minutes" from a Retry-After value. */
export function rateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) return "Too many attempts — try again later.";
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts — try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

/**
 * Accepts only same-origin absolute paths ("/dashboard/projects"), rejecting
 * protocol-relative ("//evil.com") and backslash tricks ("/\evil.com").
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
