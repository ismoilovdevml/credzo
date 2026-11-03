import { NextRequest } from "next/server";
import { enableUserTwoFactor, getUserTwoFactorState } from "@/lib/db";
import { generateBackupCodes, hashBackupCode, verifyTotp } from "@/lib/crypto-server";
import { logAudit } from "@/lib/audit";
import { errorResponse, handleRouteError, readJsonBody, requireAuth, successResponse } from "@/lib/middleware";
import { getRequestMeta, rateLimitedResponse, twoFactorLimiter } from "@/lib/rate-limit";
import { HTTP_STATUS } from "@/lib/config/constants";
import { readRequiredString, requireObject } from "@/lib/utils/input";
import { AuditAction, AuditResource } from "@/lib/types";

/**
 * POST /api/account/2fa/enable
 * Body: { code } - current 6-digit code from the authenticator app.
 * → { success, data: { backupCodes: string[10] } } (shown once; only hashes are stored).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, organization } = auth.authContext;

    const limit = twoFactorLimiter.check(user.id);
    if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

    const body = requireObject(await readJsonBody(request));
    const code = readRequiredString(body, "code", "Verification code", { max: 32 });

    const state = getUserTwoFactorState(user.id);
    if (state?.enabled) {
      return errorResponse("Two-factor authentication is already enabled", HTTP_STATUS.CONFLICT);
    }
    if (!state?.secret) {
      return errorResponse("Start two-factor setup first", HTTP_STATUS.BAD_REQUEST);
    }

    const step = verifyTotp(state.secret, code);
    if (step === null) {
      twoFactorLimiter.hit(user.id);
      return errorResponse("Invalid verification code", HTTP_STATUS.BAD_REQUEST);
    }

    const backupCodes = generateBackupCodes(10);
    enableUserTwoFactor(user.id, step, backupCodes.map(hashBackupCode));
    twoFactorLimiter.reset(user.id);

    const { ipAddress, userAgent } = getRequestMeta(request.headers);
    logAudit({
      userId: user.id,
      organizationId: organization?.id,
      action: AuditAction.TWO_FACTOR_ENABLED,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      ipAddress,
      userAgent,
    });

    return successResponse({ backupCodes });
  } catch (error) {
    return handleRouteError(error, "POST /api/account/2fa/enable");
  }
}
