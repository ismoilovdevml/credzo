import { NextRequest, NextResponse } from "next/server";
import { createProject } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import {
  canCreateOrganizationProjects,
  getDefaultProjectOrganizationId,
  getOrganizationRole,
  getProjectRef,
  listAccessibleProjects,
  loadAccessScope,
} from "@/lib/authorization";
import { logProjectCreated } from "@/lib/audit";
import { PROJECT_CONFIG } from "@/lib/config/constants";
import { buildProjectSummaries } from "@/lib/utils/projects";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { readOptionalString, readRequiredString, requireObject } from "@/lib/utils/input";
import type { AuthContext } from "@/lib/types";

/**
 * GET /api/projects
 * Projects the caller can read, with counts, environment breakdown and their role.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const projects = listAccessibleProjects(loadAccessScope(auth.authContext));
    return successResponse(buildProjectSummaries(projects));
  } catch (error) {
    return handleRouteError(error, "GET /api/projects");
  }
}

/**
 * Organization for a new project: absent → caller's default organization,
 * null → personal project, string → that organization (caller must be owner/admin/member).
 */
function resolveTargetOrganization(context: AuthContext, value: unknown): string | undefined {
  if (value === undefined) return getDefaultProjectOrganizationId(context);
  if (value === null) return undefined;
  if (typeof value !== "string" || !value) {
    throw new ValidationError("Organization ID must be a string or null");
  }

  const role = getOrganizationRole(context, value);
  if (!role) throw new NotFoundError("Organization");
  if (!canCreateOrganizationProjects(role)) {
    throw new AuthorizationError("Viewers cannot create projects in this organization");
  }
  return value;
}

/**
 * POST /api/projects
 * Body: { name, description?, organizationId?: string | null }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const body = requireObject(await readJsonBody(request));
    const name = readRequiredString(body, "name", "Project name", {
      min: PROJECT_CONFIG.NAME_MIN_LENGTH,
      max: PROJECT_CONFIG.NAME_MAX_LENGTH,
    });
    const description = readOptionalString(body, "description", "Description", {
      max: PROJECT_CONFIG.DESCRIPTION_MAX_LENGTH,
    });
    const organizationId = resolveTargetOrganization(authContext, body.organizationId);

    const created = createProject(name, description ?? "", authContext.user.id, organizationId);

    logProjectCreated(authContext.user.id, created.id, created.name, organizationId, {
      visibility: created.visibility,
    });

    const project = getProjectRef(created.id);
    if (!project) throw new Error("Project insert returned no row");

    const [summary] = buildProjectSummaries([{ project, role: "owner" }]);
    return successResponse(summary, 201);
  } catch (error) {
    return handleRouteError(error, "POST /api/projects");
  }
}
