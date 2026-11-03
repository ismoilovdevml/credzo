import { NextRequest, NextResponse } from "next/server";
import { completeTwoFactorLogin, setSessionCookie, toPublicUser } from "@/lib/auth";
import { errorResponse, handleRouteError, readJsonBody } from "@/lib/middleware";
import { getRequestMeta, rateLimitedResponse } from "@/lib/rate-limit";
import { HTTP_STATUS } from "@/lib/config/constants";
import { readRequiredString, requireObject } from "@/lib/utils/input";

/**
 * POST /api/auth/login/2fa
 * Body: { challenge, code } - code is a 6-digit TOTP or a one-time backup code.
 * 200 { success, user } + session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const body = requireObject(await readJsonBody(request));
    const challenge = readRequiredString(body, "challenge", "Challenge", { max: 128 });
    const code = readRequiredString(body, "code", "Verification code", { max: 32 });

    const result = completeTwoFactorLogin({ challenge, code }, getRequestMeta(request.headers));

    switch (result.status) {
      case "rate_limited":
        return rateLimitedResponse(result.retryAfterSeconds);
      case "invalid_challenge":
        return errorResponse("This sign-in attempt has expired. Please sign in again.", HTTP_STATUS.UNAUTHORIZED);
      case "invalid_code":
        return errorResponse("Invalid verification code", HTTP_STATUS.UNAUTHORIZED);
      case "success": {
        const response = NextResponse.json(
          { success: true, user: toPublicUser(result.user) },
          { headers: { "Cache-Control": "no-store" } }
        );
        setSessionCookie(response, result.token, result.persistent);
        return response;
      }
    }
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/login/2fa");
  }
}
