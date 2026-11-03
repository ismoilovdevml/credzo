import { NextRequest, NextResponse } from "next/server";
import { createCredential, getProjectCredentials } from "@/lib/db";
import {
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
import { logCredentialCreated } from "@/lib/audit";
import { getRequestMeta } from "@/lib/rate-limit";
import { CREDENTIAL_CONFIG } from "@/lib/config/constants";
import { CREDENTIAL_ENVIRONMENTS } from "@/lib/types";
import {
  type CredentialView,
  credentialMatchesQuery,
  parseCredentialInput,
  toCredentialView,
} from "@/lib/utils/credentials";
import { requireObject, readRequiredString } from "@/lib/utils/input";
import { ValidationError } from "@/lib/utils/errors";

/**
 * GET /api/credentials
 * Credentials (secret fields masked) across every project the caller can read.
 * Query: projectId (single project), q (search), environment (production|staging|development|none).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get("projectId");
    const query = searchParams.get("q")?.trim() ?? "";
    const environment = searchParams.get("environment");

    if (query.length > CREDENTIAL_CONFIG.SEARCH_MAX_LENGTH) {
      throw new ValidationError(
        `Search must not exceed ${CREDENTIAL_CONFIG.SEARCH_MAX_LENGTH} characters`
      );
    }
    const environmentFilters: readonly string[] = [...CREDENTIAL_ENVIRONMENTS, "none"];
    if (environment && !environmentFilters.includes(environment)) {
      throw new ValidationError(`Environment must be one of: ${environmentFilters.join(", ")}`);
    }

    const projects = projectId
      ? [requireProjectAccess(auth.authContext, projectId, "read")]
      : listAccessibleProjects(loadAccessScope(auth.authContext));

    const results: (CredentialView & { projectName: string })[] = [];
    for (const { project } of projects) {
      for (const credential of getProjectCredentials(project.id)) {
        const view = toCredentialView(credential, project);
        if (environment && (view.environment ?? "none") !== environment) continue;
        if (query && !credentialMatchesQuery(view, query)) continue;
        results.push({ ...view, projectName: project.name });
      }
    }

    return successResponse(results);
  } catch (error) {
    return handleRouteError(error, "GET /api/credentials");
  }
}

/**
 * POST /api/credentials
 * Create a credential. Requires editor access to the target project.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const body = requireObject(await readJsonBody(request));
    const projectId = readRequiredString(body, "projectId", "Project ID", { max: 100 });
    const { project } = requireProjectAccess(authContext, projectId, "edit");
    const input = parseCredentialInput(body);

    const credential = createCredential(
      project.id,
      { ...input, createdBy: authContext.user.id },
      authContext.user.id
    );
    if (!credential) throw new Error("Credential insert returned no row");

    logCredentialCreated(
      getRequestMeta(request.headers),
      authContext.user.id,
      credential.id,
      credential.name,
      credential.type,
      project.id,
      project.organizationId ?? undefined
    );

    return successResponse(toCredentialView(credential, project), 201);
  } catch (error) {
    return handleRouteError(error, "POST /api/credentials");
  }
}
