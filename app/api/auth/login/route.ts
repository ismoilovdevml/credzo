import { NextRequest, NextResponse } from "next/server";
import { login, setSessionCookie, toPublicUser, PASSWORD_MAX_LENGTH } from "@/lib/auth";
import { errorResponse, handleRouteError, readJsonBody } from "@/lib/middleware";
import { getRequestMeta, rateLimitedResponse } from "@/lib/rate-limit";
import { ERROR_MESSAGES, HTTP_STATUS } from "@/lib/config/constants";
import { readOptionalBoolean, readOptionalString, readRequiredString, requireObject } from "@/lib/utils/input";
import { ValidationError } from "@/lib/utils/errors";

/**
 * POST /api/auth/login
 * Body: { username (username or email), password, remember? = true }
 * 200 { success, user } + session cookie, or
 * 200 { success, requiresTwoFactor: true, challenge } when 2FA is enabled (no cookie).
 */
export async function POST(request: NextRequest) {
  try {
    const body = requireObject(await readJsonBody(request));
    const identifier =
      readOptionalString(body, "username", "Username or email", { max: 254 }) ||
      readOptionalString(body, "identifier", "Username or email", { max: 254 });
    if (!identifier) throw new ValidationError("Username or email is required");
    const password = readRequiredString(body, "password", "Password", { max: PASSWORD_MAX_LENGTH, raw: true });
    const persistent = readOptionalBoolean(body, "remember", "Remember me") ?? true;

    const result = await login({ identifier, password, persistent }, getRequestMeta(request.headers));

    switch (result.status) {
      case "rate_limited":
        return rateLimitedResponse(result.retryAfterSeconds);
      case "invalid":
        return errorResponse(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
      case "two_factor_required":
        return NextResponse.json(
          { success: true, requiresTwoFactor: true, challenge: result.challenge },
          { headers: { "Cache-Control": "no-store" } }
        );
      case "success": {
        const response = NextResponse.json(
          { success: true, requiresTwoFactor: false, user: toPublicUser(result.user) },
          { headers: { "Cache-Control": "no-store" } }
        );
        setSessionCookie(response, result.token, result.persistent);
        return response;
      }
    }
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/login");
  }
}
