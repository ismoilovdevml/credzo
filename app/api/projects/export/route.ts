import { NextRequest, NextResponse } from "next/server";
import { getProjectCredentials } from "@/lib/db";
import {
  getClientIp,
  getUserAgent,
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import {
  listAccessibleProjects,
  loadAccessScope,
  requireProjectAccess,
} from "@/lib/authorization";
import { logAudit } from "@/lib/audit";
import { REQUEST_LIMITS } from "@/lib/config/constants";
import { AuditAction, AuditResource } from "@/lib/types";
import { ValidationError } from "@/lib/utils/errors";
import { readOptionalStringArray, requireObject } from "@/lib/utils/input";

/**
 * POST /api/projects/export
 * Body: { projectIds?: string[] } (omit for every readable project).
 * Returns projects with fully decrypted credentials in the import format, for
 * client-side encrypted backups. Every exported project is audit-logged.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const body = requireObject(await readJsonBody(request));
    const projectIds = readOptionalStringArray(body, "projectIds", "Project IDs", {
      maxItems: REQUEST_LIMITS.IMPORT_MAX_PROJECTS,
      maxLength: 100,
    });
    if (projectIds && projectIds.length === 0) {
      throw new ValidationError("Select at least one project to export");
    }

    const projects = projectIds
      ? projectIds.map((id) => requireProjectAccess(authContext, id, "read").project)
      : listAccessibleProjects(loadAccessScope(authContext)).map(({ project }) => project);

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    const exported = projects.map((project) => {
      logAudit({
        organizationId: project.organizationId ?? undefined,
        userId: authContext.user.id,
        action: AuditAction.EXPORTED,
        resourceType: AuditResource.PROJECT,
        resourceId: project.id,
        details: { projectName: project.name },
        ipAddress,
        userAgent,
      });

      return {
        name: project.name,
        description: project.description,
        credentials: getProjectCredentials(project.id).map((credential) => ({
          name: credential.name,
          type: credential.type,
          description: credential.description ?? "",
          fields: credential.fields,
          linkedServers: credential.linkedServers ?? [],
          environment: credential.environment ?? null,
          rotationDays: credential.rotationDays ?? null,
        })),
      };
    });

    return successResponse({
      type: projectIds ? "partial" : "full",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      projects: exported,
    });
  } catch (error) {
    return handleRouteError(error, "POST /api/projects/export");
  }
}
