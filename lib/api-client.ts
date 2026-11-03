/**
 * Browser-side JSON client for the app's API routes.
 *
 * Domain routes answer `{ success, data?, error?, code? }`; `api.get/post/put/patch/del`
 * unwrap `data`. The auth/* routes put their fields at the top level (`{ success, user, … }`);
 * use `fetchJson` to receive the whole payload.
 */

export class ApiError extends Error {
  constructor(
    /** HTTP status; 0 when the request never reached the server. */
    readonly status: number,
    message: string,
    /** Machine-readable `code` from the error payload, when present. */
    readonly code?: string,
    /** Seconds from a Retry-After header (429). */
    readonly retryAfter?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Redirect to /login?next=<current path> on 401. Default true; public pages and the sign-in forms opt out. */
  redirectOn401?: boolean;
  /** Message for an error response without `error` text. Default "Request failed (<status>)". */
  fallbackError?: string;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const NETWORK_ERROR = "Network error. Check your connection and try again.";
const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Sends the browser to the sign-in page, returning here afterwards. */
export function redirectToLogin(): void {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

/**
 * Performs a same-origin JSON request and returns the full success payload.
 * Throws ApiError for network failures, non-2xx responses and `success !== true`;
 * an aborted request rethrows the abort error untouched.
 */
export async function fetchJson<T>(
  method: Method,
  url: string,
  { body, signal, redirectOn401 = true, fallbackError }: RequestOptions & { body?: unknown } = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, NETWORK_ERROR);
  }

  if (response.status === 401 && redirectOn401) {
    redirectToLogin();
    throw new ApiError(401, SESSION_EXPIRED);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(payload) || payload.success !== true) {
    const message =
      isObject(payload) && typeof payload.error === "string" && payload.error
        ? payload.error
        : (fallbackError ?? `Request failed (${response.status})`);
    const code = isObject(payload) && typeof payload.code === "string" ? payload.code : undefined;
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(response.status, message, code, retryAfter > 0 ? retryAfter : undefined);
  }
  return payload as T;
}

async function request<T>(method: Method, url: string, options?: RequestOptions & { body?: unknown }): Promise<T> {
  const payload = await fetchJson<{ data?: unknown }>(method, url, options);
  return payload.data as T;
}

/** `{ success, data }` helpers: each resolves to `data`. */
export const api = {
  get: <T>(url: string, options?: RequestOptions) => request<T>("GET", url, options),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) => request<T>("POST", url, { ...options, body }),
  put: <T>(url: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", url, { ...options, body }),
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) => request<T>("PATCH", url, { ...options, body }),
  del: <T>(url: string, options?: RequestOptions & { body?: unknown }) => request<T>("DELETE", url, options),
};

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
