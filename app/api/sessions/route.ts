import { NextRequest } from "next/server";
import { deleteUserSessions, getUserSessions } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { getRequestMeta } from "@/lib/rate-limit";
import type { SessionSummary } from "@/lib/types";
import { AuditAction, AuditResource } from "@/lib/types";

/** GET /api/sessions → { success, data: SessionSummary[] } (the current user's active sessions). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, sessionId } = auth.authContext;

    const sessions: SessionSummary[] = getUserSessions(user.id).map((session) => ({
      id: session.id,
      userAgent: session.userAgent ?? null,
      ip: session.ipAddress ?? null,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      current: session.id === sessionId,
    }));

    return successResponse(sessions);
  } catch (error) {
    return handleRouteError(error, "GET /api/sessions");
  }
}

/** DELETE /api/sessions → { success, data: { revoked } } (signs out every other session). */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, sessionId, organization } = auth.authContext;

    const revoked = deleteUserSessions(user.id, sessionId);

    const { ipAddress, userAgent } = getRequestMeta(request.headers);
    logAudit({
      userId: user.id,
      organizationId: organization?.id,
      action: AuditAction.SESSION_REVOKED,
      resourceType: AuditResource.SESSION,
      details: { revokedCount: revoked, scope: "others" },
      ipAddress,
      userAgent,
    });

    return successResponse({ revoked });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/sessions");
  }
}
