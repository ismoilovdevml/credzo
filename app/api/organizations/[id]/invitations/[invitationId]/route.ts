import { NextRequest, NextResponse } from "next/server";
import { getPendingInvitations, revokeInvitation } from "@/lib/db";
import { handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { assertCanGrantOrganizationRole, requireOrganizationAccess } from "@/lib/authorization";
import { logInvitationRevoked } from "@/lib/audit";
import { getRequestMeta } from "@/lib/rate-limit";
import { NotFoundError } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ id: string; invitationId: string }> };

/**
 * DELETE /api/organizations/[id]/invitations/[invitationId]
 * Revokes a pending invitation (status "revoked"). Owners and admins only;
 * only owners may revoke an invitation that grants the owner role.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id, invitationId } = await params;
    const { organization, role: actorRole } = requireOrganizationAccess(authContext, id, "manage");

    const pending = getPendingInvitations(organization.id).find((invitation) => invitation.id === invitationId);
    if (!pending) throw new NotFoundError("Invitation");
    assertCanGrantOrganizationRole(actorRole, pending.role);

    const revoked = revokeInvitation(organization.id, invitationId);
    if (!revoked) throw new NotFoundError("Invitation");

    logInvitationRevoked(
      getRequestMeta(request.headers),
      authContext.user.id,
      organization.id,
      revoked.id,
      revoked.email,
      revoked.role
    );

    return successResponse({ id: revoked.id });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/organizations/[id]/invitations/[invitationId]");
  }
}
