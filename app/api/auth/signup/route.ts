import { NextRequest, NextResponse } from "next/server";
import { assertPasswordPolicy, PASSWORD_MAX_LENGTH, setSessionCookie, signup, toPublicUser } from "@/lib/auth";
import { handleRouteError, readJsonBody } from "@/lib/middleware";
import { getRequestMeta, rateLimitedResponse, signupLimiter } from "@/lib/rate-limit";
import { ERROR_MESSAGES, HTTP_STATUS, INVITATION_CONFIG, REGEX_PATTERNS } from "@/lib/config/constants";
import { readRequiredEmail, readRequiredString, requireObject } from "@/lib/utils/input";
import { ValidationError } from "@/lib/utils/errors";

/**
 * POST /api/auth/signup
 * Body: { username, email, password, firstName, lastName }
 * 201 { success, user } + session cookie. The first account becomes platform admin.
 */
export async function POST(request: NextRequest) {
  try {
    const meta = getRequestMeta(request.headers);
    const limit = signupLimiter.check(meta.ipAddress);
    if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

    const body = requireObject(await readJsonBody(request));
    const username = readRequiredString(body, "username", "Username", { min: 3, max: 32 });
    if (!REGEX_PATTERNS.USERNAME.test(username)) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_USERNAME);
    }
    const email = readRequiredEmail(body, "email", "Email", INVITATION_CONFIG.EMAIL_MAX_LENGTH);
    const firstName = readRequiredString(body, "firstName", "First name", { max: 50 });
    const lastName = readRequiredString(body, "lastName", "Last name", { max: 50 });
    const password = readRequiredString(body, "password", "Password", { max: PASSWORD_MAX_LENGTH, raw: true });
    assertPasswordPolicy(password);

    const { user, token } = await signup({ username, email, password, firstName, lastName }, meta);
    signupLimiter.hit(meta.ipAddress);

    const response = NextResponse.json(
      { success: true, user: toPublicUser(user) },
      { status: HTTP_STATUS.CREATED, headers: { "Cache-Control": "no-store" } }
    );
    setSessionCookie(response, token, true);
    return response;
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/signup");
  }
}
