import { NextRequest } from "next/server";
import { disableUserTwoFactor } from "@/lib/db";
import { checkCurrentPassword, PASSWORD_MAX_LENGTH, verifySecondFactor } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { errorResponse, handleRouteError, readJsonBody, requireAuth, successResponse } from "@/lib/middleware";
import { getRequestMeta, rateLimitedResponse, twoFactorLimiter } from "@/lib/rate-limit";
import { HTTP_STATUS } from "@/lib/config/constants";
import { readRequiredString, requireObject } from "@/lib/utils/input";
import { AuditAction, AuditResource } from "@/lib/types";

/**
 * POST /api/account/2fa/disable
 * Body: { password, code } - code is a TOTP or an unused backup code.
 * → { success, data: { totpEnabled: false } }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, organization } = auth.authContext;

    if (!user.totpEnabled) {
      return errorResponse("Two-factor authentication is not enabled", HTTP_STATUS.CONFLICT);
    }

    const limit = twoFactorLimiter.check(user.id);
    if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

    const body = requireObject(await readJsonBody(request));
    const password = readRequiredString(body, "password", "Password", { max: PASSWORD_MAX_LENGTH, raw: true });
    const code = readRequiredString(body, "code", "Verification code", { max: 32 });

    const check = await checkCurrentPassword(user, password);
    if (!check.ok) {
      return check.retryAfterSeconds
        ? rateLimitedResponse(check.retryAfterSeconds)
        : errorResponse("Password is incorrect", HTTP_STATUS.BAD_REQUEST);
    }

    if (!verifySecondFactor(user.id, code)) {
      twoFactorLimiter.hit(user.id);
      return errorResponse("Invalid verification code", HTTP_STATUS.BAD_REQUEST);
    }

    disableUserTwoFactor(user.id);
    twoFactorLimiter.reset(user.id);

    const { ipAddress, userAgent } = getRequestMeta(request.headers);
    logAudit({
      userId: user.id,
      organizationId: organization?.id,
      action: AuditAction.TWO_FACTOR_DISABLED,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      ipAddress,
      userAgent,
    });

    return successResponse({ totpEnabled: false });
  } catch (error) {
    return handleRouteError(error, "POST /api/account/2fa/disable");
  }
}
