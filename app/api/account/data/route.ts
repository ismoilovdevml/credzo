import { NextRequest } from "next/server";
import { deletePersonalProjects } from "@/lib/db";
import { checkCurrentPassword, PASSWORD_MAX_LENGTH } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { errorResponse, handleRouteError, readJsonBody, requireAuth, successResponse } from "@/lib/middleware";
import { getRequestMeta, rateLimitedResponse } from "@/lib/rate-limit";
import { HTTP_STATUS } from "@/lib/config/constants";
import { readRequiredString, requireObject } from "@/lib/utils/input";
import { AuditAction, AuditResource } from "@/lib/types";

/**
 * DELETE /api/account/data
 * Body: { password }
 * Deletes the user's personal projects and their credentials: projects with no
 * organization, or in a workspace the user owns that has no other members.
 * Shared organization projects are kept. → { success, data: { projects, credentials } }
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, organization } = auth.authContext;

    const body = requireObject(await readJsonBody(request));
    const password = readRequiredString(body, "password", "Password", { max: PASSWORD_MAX_LENGTH, raw: true });

    const check = await checkCurrentPassword(user, password);
    if (!check.ok) {
      return check.retryAfterSeconds
        ? rateLimitedResponse(check.retryAfterSeconds)
        : errorResponse("Password is incorrect", HTTP_STATUS.BAD_REQUEST);
    }

    const deleted = deletePersonalProjects(user.id);

    const { ipAddress, userAgent } = getRequestMeta(request.headers);
    logAudit({
      userId: user.id,
      organizationId: organization?.id,
      action: AuditAction.DELETED,
      resourceType: AuditResource.ACCOUNT,
      resourceId: user.id,
      details: { deletedProjects: deleted.projects, deletedCredentials: deleted.credentials },
      ipAddress,
      userAgent,
    });

    return successResponse(deleted);
  } catch (error) {
    return handleRouteError(error, "DELETE /api/account/data");
  }
}
