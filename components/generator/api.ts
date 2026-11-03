/** Minimal JSON client for the `{ success, data, error, code }` API envelope. */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /** Seconds from a Retry-After header (429). */
    readonly retryAfter?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** Redirect to /login?next=<current path> on 401 (dashboard calls). Default true. */
  redirectOn401?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function apiRequest<T>(url: string, { method = "GET", body, redirectOn401 = true }: ApiRequestOptions = {}): Promise<T> {
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

  if (response.status === 401 && redirectOn401) {
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(payload) || payload.success !== true) {
    const message =
      isObject(payload) && typeof payload.error === "string" && payload.error
        ? payload.error
        : `Request failed (${response.status})`;
    const code = isObject(payload) && typeof payload.code === "string" ? payload.code : undefined;
    const retryAfter = Number(response.headers.get("Retry-After")) || undefined;
    throw new ApiError(message, response.status, code, retryAfter);
  }
  return payload.data as T;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
