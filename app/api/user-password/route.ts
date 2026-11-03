import { NextRequest } from "next/server";
import { deleteUserSessions, getUserById, updateUserPassword } from "@/lib/db";
import { assertPasswordPolicy, checkCurrentPassword, hashPassword, PASSWORD_MAX_LENGTH } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { errorResponse, handleRouteError, readJsonBody, requireAuth, successResponse } from "@/lib/middleware";
import { getRequestMeta, rateLimitedResponse } from "@/lib/rate-limit";
import { HTTP_STATUS } from "@/lib/config/constants";
import { readRequiredString, requireObject } from "@/lib/utils/input";
import { ValidationError } from "@/lib/utils/errors";
import { AuditAction, AuditResource } from "@/lib/types";

/**
 * POST /api/user-password
 * Body: { currentPassword, newPassword }
 * → { success, data: { passwordChangedAt, revokedSessions } }. Other sessions are signed out.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, sessionId, organization } = auth.authContext;

    const body = requireObject(await readJsonBody(request));
    const currentPassword = readRequiredString(body, "currentPassword", "Current password", {
      max: PASSWORD_MAX_LENGTH,
      raw: true,
    });
    const newPassword = readRequiredString(body, "newPassword", "New password", { max: PASSWORD_MAX_LENGTH, raw: true });
    assertPasswordPolicy(newPassword, "New password");
    if (newPassword === currentPassword) {
      throw new ValidationError("New password must be different from the current password");
    }

    const check = await checkCurrentPassword(user, currentPassword);
    if (!check.ok) {
      return check.retryAfterSeconds
        ? rateLimitedResponse(check.retryAfterSeconds)
        : errorResponse("Current password is incorrect", HTTP_STATUS.BAD_REQUEST);
    }

    updateUserPassword(user.id, await hashPassword(newPassword));
    const revokedSessions = deleteUserSessions(user.id, sessionId);

    const { ipAddress, userAgent } = getRequestMeta(request.headers);
    logAudit({
      userId: user.id,
      organizationId: organization?.id,
      action: AuditAction.PASSWORD_CHANGED,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      details: { revokedSessions },
      ipAddress,
      userAgent,
    });

    return successResponse({ passwordChangedAt: getUserById(user.id)?.passwordChangedAt ?? null, revokedSessions });
  } catch (error) {
    return handleRouteError(error, "POST /api/user-password");
  }
}
