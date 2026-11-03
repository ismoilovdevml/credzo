/** JSON client for the account settings endpoints (`{ success, data, error }` envelope). */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Fetches a same-origin API route; redirects to /login?next=<current path> on 401. */
export async function apiRequest<T>(url: string, { method = "GET", body }: { method?: Method; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Network error. Check your connection and try again.", 0);
  }

  if (response.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? ` Try again in ${formatWait(retryAfter)}.` : " Try again later.";
    throw new ApiError(`Too many attempts.${wait}`, 429);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(payload) || payload.success !== true) {
    const message =
      isObject(payload) && typeof payload.error === "string" && payload.error
        ? payload.error
        : response.status === 413
          ? "The file is too large to import (max 5 MB)."
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload.data as T;
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
