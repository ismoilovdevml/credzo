import { NextRequest, NextResponse } from "next/server";
import { deleteProject, getProjectCredentials, updateProject } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { getProjectRef, hasProjectAccess, requireProjectAccess } from "@/lib/authorization";
import { logProjectDeleted, logProjectUpdated } from "@/lib/audit";
import { PROJECT_CONFIG } from "@/lib/config/constants";
import { toCredentialView } from "@/lib/utils/credentials";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import {
  readOptionalEnum,
  readOptionalString,
  requireObject,
} from "@/lib/utils/input";
import {
  buildProjectSummaries,
  getUserSummary,
  listProjectMembers,
} from "@/lib/utils/projects";

type RouteContext = { params: Promise<{ id: string }> };

const VISIBILITIES = ["private", "organization"] as const;

/**
 * GET /api/projects/[id]
 * Project summary plus owner, explicit members and credentials (secret fields masked).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { project, role } = requireProjectAccess(auth.authContext, id, "read");
    const [summary] = buildProjectSummaries([{ project, role }]);

    return successResponse({
      ...summary,
      owner: getUserSummary(project.ownerId),
      members: listProjectMembers(project.id),
      credentials: getProjectCredentials(project.id).map((credential) =>
        toCredentialView(credential, project.id)
      ),
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/projects/[id]");
  }
}

/**
 * PATCH /api/projects/[id]
 * Body: { name?, description?, visibility? }. Editors may rename/describe;
 * changing visibility requires project owner access.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { project, role } = requireProjectAccess(authContext, id, "edit");
    const body = requireObject(await readJsonBody(request));

    const name = readOptionalString(body, "name", "Project name", {
      min: PROJECT_CONFIG.NAME_MIN_LENGTH,
      max: PROJECT_CONFIG.NAME_MAX_LENGTH,
    });
    if (name === "") throw new ValidationError("Project name cannot be empty");
    const description = readOptionalString(body, "description", "Description", {
      max: PROJECT_CONFIG.DESCRIPTION_MAX_LENGTH,
    });
    const visibility = readOptionalEnum(body, "visibility", "Visibility", VISIBILITIES);

    if (visibility !== undefined) {
      if (!hasProjectAccess(role, "manage")) {
        throw new AuthorizationError("Only project owners can change visibility");
      }
      if (visibility === "organization" && !project.organizationId) {
        throw new ValidationError("Personal projects cannot be shared with an organization");
      }
    }

    const changes: Record<string, unknown> = {};
    if (name !== undefined && name !== project.name) changes.name = { from: project.name, to: name };
    if (description !== undefined && description !== project.description) changes.description = "updated";
    if (visibility !== undefined && visibility !== project.visibility) {
      changes.visibility = { from: project.visibility, to: visibility };
    }
    if (Object.keys(changes).length === 0) {
      const [summary] = buildProjectSummaries([{ project, role }]);
      return successResponse(summary);
    }

    updateProject(id, { name, description, visibility });
    logProjectUpdated(
      authContext.user.id,
      project.id,
      name ?? project.name,
      changes,
      project.organizationId ?? undefined
    );

    const updated = getProjectRef(id);
    if (!updated) throw new NotFoundError("Project");
    const [summary] = buildProjectSummaries([{ project: updated, role }]);
    return successResponse(summary);
  } catch (error) {
    return handleRouteError(error, "PATCH /api/projects/[id]");
  }
}

/**
 * DELETE /api/projects/[id]
 * Deletes the project with its credentials, services and member grants. Owners only.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { project } = requireProjectAccess(authContext, id, "manage");

    if (!deleteProject(id)) throw new NotFoundError("Project");

    logProjectDeleted(authContext.user.id, project.id, project.name, project.organizationId ?? undefined);

    return successResponse({ id: project.id });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/projects/[id]");
  }
}
