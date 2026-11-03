import { NextRequest, NextResponse } from "next/server";
import { getPendingInvitations } from "@/lib/db";
import { handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { requireOrganizationAccess } from "@/lib/authorization";
import { getUserSummary } from "@/lib/utils/projects";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/organizations/[id]/invitations
 * Pending, unexpired invitations (owners and admins only), newest first.
 * Invitation tokens are never returned.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { organization } = requireOrganizationAccess(auth.authContext, id, "manage");

    return successResponse(
      getPendingInvitations(organization.id).map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        invitedBy: invitation.invitedBy ? getUserSummary(invitation.invitedBy) : null,
      }))
    );
  } catch (error) {
    return handleRouteError(error, "GET /api/organizations/[id]/invitations");
  }
}
