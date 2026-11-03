import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getOrganizationMember,
  getUserById,
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import {
  ORGANIZATION_ROLES,
  assertCanChangeMemberRole,
  assertCanRemoveMember,
  requireOrganizationAccess,
} from "@/lib/authorization";
import { logMemberRemoved, logMemberRoleChanged } from "@/lib/audit";
import { getRequestMeta } from "@/lib/rate-limit";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { readRequiredEnum, requireObject } from "@/lib/utils/input";
import { getUserSummary } from "@/lib/utils/projects";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

/**
 * PUT /api/organizations/[id]/members/[userId]
 * Body: { role }. Owners and admins only. Admins cannot change owners or grant
 * ownership, and the last owner cannot be demoted.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id, userId } = await params;
    const { organization, role: actorRole } = requireOrganizationAccess(authContext, id, "manage");

    const body = requireObject(await readJsonBody(request));
    const newRole = readRequiredEnum(body, "role", "Role", ORGANIZATION_ROLES);

    const member = getOrganizationMember(organization.id, userId);
    if (!member) throw new NotFoundError("Member");
    if (member.role === newRole) {
      return successResponse({ ...member, user: getUserSummary(userId) });
    }

    assertCanChangeMemberRole(organization.id, actorRole, member.role, newRole);

    const updated = updateOrganizationMemberRole(organization.id, userId, newRole);
    if (!updated) throw new NotFoundError("Member");

    logMemberRoleChanged(
      getRequestMeta(request.headers),
      authContext.user.id,
      organization.id,
      userId,
      getUserById(userId)?.username ?? "",
      member.role,
      newRole
    );

    return successResponse({ ...updated, user: getUserSummary(userId) });
  } catch (error) {
    return handleRouteError(error, "PUT /api/organizations/[id]/members/[userId]");
  }
}

/**
 * DELETE /api/organizations/[id]/members/[userId]
 * Owners and admins only. Admins cannot remove owners, the last owner cannot be
 * removed, and members cannot remove themselves. The member's project grants
 * inside the organization are revoked too.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id, userId } = await params;
    const { organization, role: actorRole } = requireOrganizationAccess(authContext, id, "manage");

    const member = getOrganizationMember(organization.id, userId);
    if (!member) throw new NotFoundError("Member");
    if (userId === authContext.user.id) {
      throw new ValidationError("You cannot remove yourself from the organization");
    }
    assertCanRemoveMember(organization.id, actorRole, member.role);

    const database = getDb();
    database.transaction(() => {
      database
        .prepare(
          `DELETE FROM project_members
           WHERE user_id = ? AND project_id IN (SELECT id FROM projects WHERE organization_id = ?)`
        )
        .run(userId, organization.id);
      removeOrganizationMember(organization.id, userId);
    })();

    logMemberRemoved(
      getRequestMeta(request.headers),
      authContext.user.id,
      organization.id,
      userId,
      getUserById(userId)?.username ?? "",
      member.role
    );

    return successResponse({ userId });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/organizations/[id]/members/[userId]");
  }
}
