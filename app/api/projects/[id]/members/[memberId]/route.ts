import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { PROJECT_ROLES, requireProjectAccess } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";
import { AuditAction, AuditResource } from "@/lib/types";
import { NotFoundError } from "@/lib/utils/errors";
import { readRequiredEnum, requireObject } from "@/lib/utils/input";
import { getProjectMember } from "@/lib/utils/projects";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

/**
 * PATCH /api/projects/[id]/members/[memberId]
 * Body: { role: "owner" | "editor" | "viewer" }. Project owners only.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id, memberId } = await params;
    const { project } = requireProjectAccess(authContext, id, "manage");

    const body = requireObject(await readJsonBody(request));
    const role = readRequiredEnum(body, "role", "Role", PROJECT_ROLES);

    const member = getProjectMember(project.id, memberId);
    if (!member) throw new NotFoundError("Member");

    if (member.role !== role) {
      getDb()
        .prepare("UPDATE project_members SET role = ?, updated_at = ? WHERE id = ?")
        .run(role, new Date().toISOString(), member.id);

      logAudit({
        organizationId: project.organizationId ?? undefined,
        userId: authContext.user.id,
        action: AuditAction.ROLE_CHANGED,
        resourceType: AuditResource.MEMBER,
        resourceId: member.userId,
        details: { projectId: project.id, oldRole: member.role, newRole: role, context: "project_member" },
      });
    }

    return successResponse({ ...member, role });
  } catch (error) {
    return handleRouteError(error, "PATCH /api/projects/[id]/members/[memberId]");
  }
}

/**
 * DELETE /api/projects/[id]/members/[memberId]
 * Removes an explicit member grant. Project owners only.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id, memberId } = await params;
    const { project } = requireProjectAccess(authContext, id, "manage");

    const member = getProjectMember(project.id, memberId);
    if (!member) throw new NotFoundError("Member");

    getDb().prepare("DELETE FROM project_members WHERE id = ?").run(member.id);

    logAudit({
      organizationId: project.organizationId ?? undefined,
      userId: authContext.user.id,
      action: AuditAction.REMOVED,
      resourceType: AuditResource.MEMBER,
      resourceId: member.userId,
      details: { projectId: project.id, role: member.role, context: "project_member" },
    });

    return successResponse({ id: member.id });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/projects/[id]/members/[memberId]");
  }
}
