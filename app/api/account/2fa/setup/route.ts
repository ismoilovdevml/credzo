import { NextRequest } from "next/server";
import { setPendingTwoFactorSecret } from "@/lib/db";
import { buildOtpAuthUrl, generateTotpSecret } from "@/lib/crypto-server";
import { errorResponse, handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { HTTP_STATUS } from "@/lib/config/constants";

/**
 * POST /api/account/2fa/setup → { success, data: { secret, otpauthUrl } }
 * Starts (or restarts) enrollment. 2FA stays off until /api/account/2fa/enable verifies a code.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user } = auth.authContext;

    if (user.totpEnabled) {
      return errorResponse("Two-factor authentication is already enabled", HTTP_STATUS.CONFLICT);
    }

    const secret = generateTotpSecret();
    setPendingTwoFactorSecret(user.id, secret);

    return successResponse({ secret, otpauthUrl: buildOtpAuthUrl(secret, user.username) });
  } catch (error) {
    return handleRouteError(error, "POST /api/account/2fa/setup");
  }
}
