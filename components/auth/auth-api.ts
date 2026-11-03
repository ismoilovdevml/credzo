/** Shared request helpers for the public sign-in and sign-up forms. */

import { ApiError, fetchJson } from "@/lib/api-client";

const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again.";

/**
 * POSTs JSON to an auth/* endpoint and returns its top-level payload. A 401 here
 * means rejected credentials, so it never redirects to /login. Throws ApiError;
 * `fallbackError` is its message when the response carries no error text.
 */
export function postAuth<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  return fetchJson<T>("POST", url, { body, redirectOn401: false, fallbackError });
}

/** "Too many attempts — try again in N minutes" from a Retry-After value. */
function rateLimitMessage(retryAfterSeconds: number | undefined): string {
  if (retryAfterSeconds === undefined) return "Too many attempts — try again later.";
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts — try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

/** Form-level message for a failed postAuth call: network, rate limit, or the server's error. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError) || error.status === 0) return NETWORK_ERROR_MESSAGE;
  if (error.status === 429) return rateLimitMessage(error.retryAfter);
  return error.message;
}

/**
 * Accepts only same-origin absolute paths ("/dashboard/projects"), rejecting
 * protocol-relative ("//evil.com") and backslash tricks ("/\evil.com").
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
