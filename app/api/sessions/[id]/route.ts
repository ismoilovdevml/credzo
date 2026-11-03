import { NextRequest } from "next/server";
import { deleteSessionById, getUserSessions } from "@/lib/db";
import { clearSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { errorResponse, handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { getRequestMeta } from "@/lib/rate-limit";
import { HTTP_STATUS } from "@/lib/config/constants";
import { AuditAction, AuditResource } from "@/lib/types";

/**
 * DELETE /api/sessions/[id] → { success, data: { revoked: true, current } }
 * Revoking the current session also clears the cookie (i.e. signs out).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, sessionId, organization } = auth.authContext;
    const { id } = await params;

    if (!getUserSessions(user.id).some((session) => session.id === id)) {
      return errorResponse("Session not found", HTTP_STATUS.NOT_FOUND);
    }

    deleteSessionById(id);

    const { ipAddress, userAgent } = getRequestMeta(request.headers);
    logAudit({
      userId: user.id,
      organizationId: organization?.id,
      action: AuditAction.SESSION_REVOKED,
      resourceType: AuditResource.SESSION,
      resourceId: id,
      details: { scope: "single" },
      ipAddress,
      userAgent,
    });

    const current = id === sessionId;
    const response = successResponse({ revoked: true, current });
    if (current) clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleRouteError(error, "DELETE /api/sessions/[id]");
  }
}
