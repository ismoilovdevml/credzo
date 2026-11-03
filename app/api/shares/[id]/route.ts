import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  handleRouteError,
  successResponse,
  errorResponse,
  getClientIp,
  getUserAgent,
} from "@/lib/middleware";
import { logAudit } from "@/lib/audit";
import {
  SHARE_AUDIT_ACTIONS,
  SHARE_AUDIT_RESOURCE,
  getShareOwnerId,
  isValidShareId,
  revokeShare,
} from "@/lib/shares";

// DELETE /api/shares/[id] - Revoke a link and wipe its ciphertext (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { authContext } = authResult;
    const { id } = await params;

    // Unknown and foreign links look the same to avoid leaking which ids exist.
    if (!isValidShareId(id) || getShareOwnerId(id) !== authContext.user.id) {
      return errorResponse("Link not found", 404);
    }

    const result = revokeShare(id);
    if (!result) {
      return errorResponse("Link not found", 404);
    }

    if (result.revoked) {
      logAudit({
        organizationId: authContext.organization?.id,
        userId: authContext.user.id,
        action: SHARE_AUDIT_ACTIONS.REVOKED,
        resourceType: SHARE_AUDIT_RESOURCE,
        resourceId: id,
        details: { label: result.share.label, views: result.share.views },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });
    }

    return successResponse(result.share);
  } catch (error) {
    return handleRouteError(error, "shares:revoke");
  }
}
