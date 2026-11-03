import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "./auth";
import { getRequestIp } from "./rate-limit";
import { ERROR_MESSAGES, HTTP_STATUS, REQUEST_LIMITS, SESSION_CONFIG } from "./config/constants";
import { PayloadTooLargeError, ValidationError, isAppError } from "./utils/errors";
import type { AuthContext } from "./types";
import { UserRole } from "./types";

/**
 * Shared helpers for API route handlers: authentication, body parsing and
 * the `{ success, data?, error? }` response envelope.
 *
 * Cross-origin (CSRF) protection for state-changing requests is enforced
 * centrally in the root `proxy.ts`, before any route handler runs.
 */

/**
 * Validate the session cookie and return the auth context, or null.
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const token = request.cookies.get(SESSION_CONFIG.COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await validateSession(token);
  } catch (error) {
    console.error("Session validation failed:", error);
    return null;
  }
}

/**
 * Require authentication - returns a 401 response if not authenticated.
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ authContext: AuthContext } | NextResponse> {
  const authContext = await getAuthContext(request);

  if (!authContext) {
    return errorResponse(ERROR_MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
  }

  return { authContext };
}

/**
 * Require platform admin role - returns 401/403 responses otherwise.
 */
export async function requirePlatformAdmin(
  request: NextRequest
): Promise<{ authContext: AuthContext } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.authContext.user.role !== UserRole.PLATFORM_ADMIN) {
    return errorResponse("Platform admin access required", HTTP_STATUS.FORBIDDEN);
  }

  return authResult;
}

/**
 * Read and parse a JSON request body with a hard size cap.
 * Throws PayloadTooLargeError (413) or ValidationError (400).
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number = REQUEST_LIMITS.DEFAULT_JSON_BYTES
): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }

  if (!request.body) {
    throw new ValidationError("Request body is required");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    throw new ValidationError("Request body is required");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
}

/**
 * Convert a thrown error into an API response.
 * Expected (operational) errors keep their status and message; anything else
 * is logged and reported as a generic 500 so internals never leak.
 */
export function handleRouteError(error: unknown, context: string): NextResponse {
  if (isAppError(error) && error.isOperational) {
    return errorResponse(error.message, error.statusCode);
  }

  console.error(`[${context}]`, error);
  return errorResponse(ERROR_MESSAGES.GENERIC.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
}

/**
 * Get client IP address from request (see getRequestIp for TRUST_PROXY handling).
 */
export function getClientIp(request: NextRequest): string {
  return getRequestIp(request.headers);
}

/**
 * Get user agent from request.
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

/**
 * Create error response. API responses carry vault data, so they are never cached.
 */
export function errorResponse(
  message: string,
  status: number = HTTP_STATUS.BAD_REQUEST,
  code?: string
): NextResponse {
  return NextResponse.json(
    { success: false, error: message, ...(code && { code }) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Create success response. API responses carry vault data, so they are never cached.
 */
export function successResponse<T>(data: T, status: number = HTTP_STATUS.OK): NextResponse {
  return NextResponse.json(
    { success: true, data },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}
