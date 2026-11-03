import { NextRequest, NextResponse } from "next/server";
import {
  addOrganizationMember,
  createInvitation,
  getOrganizationMember,
  getOrganizationMembers,
  getPendingInvitations,
  getUserByEmail,
} from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import {
  ORGANIZATION_ROLES,
  assertCanGrantOrganizationRole,
  requireOrganizationAccess,
} from "@/lib/authorization";
import { logMemberInvited } from "@/lib/audit";
import { getRequestMeta } from "@/lib/rate-limit";
import { INVITATION_CONFIG } from "@/lib/config/constants";
import type { OrganizationMember } from "@/lib/types";
import { ConflictError } from "@/lib/utils/errors";
import { readRequiredEmail, readRequiredEnum, requireObject } from "@/lib/utils/input";
import { getUserSummary } from "@/lib/utils/projects";

type RouteContext = { params: Promise<{ id: string }> };

function withUser(member: OrganizationMember) {
  return { ...member, user: getUserSummary(member.userId) };
}

/**
 * GET /api/organizations/[id]/members
 * Members of the organization with user details. Any member may list.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { organization } = requireOrganizationAccess(auth.authContext, id, "read");
    return successResponse(getOrganizationMembers(organization.id).map(withUser));
  } catch (error) {
    return handleRouteError(error, "GET /api/organizations/[id]/members");
  }
}

/**
 * POST /api/organizations/[id]/members
 * Body: { email, role }. Owners and admins only; only owners may grant "owner".
 * Existing users are added immediately ({ type: "member", member });
 * unknown emails get a pending invitation ({ type: "invitation", invitation }).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { organization, role: actorRole } = requireOrganizationAccess(authContext, id, "manage");

    const body = requireObject(await readJsonBody(request));
    const email = readRequiredEmail(body, "email", "Email", INVITATION_CONFIG.EMAIL_MAX_LENGTH);
    const role = readRequiredEnum(body, "role", "Role", ORGANIZATION_ROLES);
    assertCanGrantOrganizationRole(actorRole, role);

    const existingUser = getUserByEmail(email);
    if (existingUser) {
      if (getOrganizationMember(organization.id, existingUser.id)) {
        throw new ConflictError("User is already a member of this organization");
      }
      const member = addOrganizationMember({
        organizationId: organization.id,
        userId: existingUser.id,
        role,
        invitedBy: authContext.user.id,
      });
      logMemberInvited(getRequestMeta(request.headers), authContext.user.id, organization.id, email, role);
      return successResponse({ type: "member", member: withUser(member) }, 201);
    }

    const now = Date.now();
    const hasPendingInvitation = getPendingInvitations(organization.id).some(
      (invitation) => invitation.email.toLowerCase() === email
    );
    if (hasPendingInvitation) {
      throw new ConflictError("An invitation for this email is already pending");
    }

    const invitation = createInvitation({
      organizationId: organization.id,
      email,
      role,
      invitedBy: authContext.user.id,
      expiresAt: new Date(now + INVITATION_CONFIG.EXPIRY_MS).toISOString(),
    });
    logMemberInvited(getRequestMeta(request.headers), authContext.user.id, organization.id, email, role);

    return successResponse(
      {
        type: "invitation",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
      },
      201
    );
  } catch (error) {
    return handleRouteError(error, "POST /api/organizations/[id]/members");
  }
}
