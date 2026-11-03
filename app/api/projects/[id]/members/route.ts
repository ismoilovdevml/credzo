import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOrganizationMember, getUserById } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { PROJECT_ROLES, requireProjectAccess } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";
import { AuditAction, AuditResource } from "@/lib/types";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { readOptionalEnum, readRequiredString, requireObject } from "@/lib/utils/input";
import { getProjectMember, listProjectMembers } from "@/lib/utils/projects";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/members
 * Explicit member grants of a project. Any project role may list them.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { project } = requireProjectAccess(auth.authContext, id, "read");
    return successResponse(listProjectMembers(project.id));
  } catch (error) {
    return handleRouteError(error, "GET /api/projects/[id]/members");
  }
}

/**
 * POST /api/projects/[id]/members
 * Body: { userId, role?: "owner" | "editor" | "viewer" (default "viewer") }. Project owners only.
 * For organization projects the user must belong to the same organization.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { project } = requireProjectAccess(authContext, id, "manage");

    const body = requireObject(await readJsonBody(request));
    const userId = readRequiredString(body, "userId", "User ID", { max: 100 });
    const role = readOptionalEnum(body, "role", "Role", PROJECT_ROLES) ?? "viewer";

    if (!getUserById(userId)) throw new NotFoundError("User");
    if (userId === project.ownerId) {
      throw new ValidationError("The project owner already has full access");
    }
    if (project.organizationId && !getOrganizationMember(project.organizationId, userId)) {
      throw new ValidationError("User is not a member of this project's organization");
    }

    const database = getDb();
    const existing = database
      .prepare("SELECT id FROM project_members WHERE project_id = ? AND user_id = ?")
      .get(project.id, userId);
    if (existing) throw new ConflictError("User is already a member of this project");

    const memberId = randomBytes(16).toString("hex");
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO project_members (id, project_id, user_id, role, added_by, added_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(memberId, project.id, userId, role, authContext.user.id, now, now);

    logAudit({
      organizationId: project.organizationId ?? undefined,
      userId: authContext.user.id,
      action: AuditAction.CREATED,
      resourceType: AuditResource.MEMBER,
      resourceId: userId,
      details: { projectId: project.id, projectName: project.name, role, context: "project_member" },
    });

    const member = getProjectMember(project.id, memberId);
    if (!member) throw new Error("Project member insert returned no row");
    return successResponse(member, 201);
  } catch (error) {
    return handleRouteError(error, "POST /api/projects/[id]/members");
  }
}
