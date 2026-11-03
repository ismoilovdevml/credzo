import { NextRequest, NextResponse } from "next/server";
import { deleteProject, getDb } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import {
  hasProjectAccess,
  listAccessibleProjects,
  loadAccessScope,
} from "@/lib/authorization";
import { logProjectDeleted } from "@/lib/audit";
import { ValidationError } from "@/lib/utils/errors";
import { requireObject } from "@/lib/utils/input";

const CONFIRMATION = "DELETE";

/**
 * POST /api/delete-all
 * Body: { confirm: "DELETE" }.
 * Deletes every project the caller owns (and can still manage), with its
 * credentials. Projects owned by other users are never touched.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const body = requireObject(await readJsonBody(request));
    if (body.confirm !== CONFIRMATION) {
      throw new ValidationError(`Set "confirm" to "${CONFIRMATION}" to delete all of your projects`);
    }

    const owned = listAccessibleProjects(loadAccessScope(authContext))
      .filter(({ project, role }) => project.ownerId === authContext.user.id && hasProjectAccess(role, "manage"))
      .map(({ project }) => project);

    const deleted = getDb().transaction(() => owned.filter((project) => deleteProject(project.id)))();

    for (const project of deleted) {
      logProjectDeleted(authContext.user.id, project.id, project.name, project.organizationId ?? undefined);
    }

    return successResponse({ deletedProjects: deleted.length });
  } catch (error) {
    return handleRouteError(error, "POST /api/delete-all");
  }
}
