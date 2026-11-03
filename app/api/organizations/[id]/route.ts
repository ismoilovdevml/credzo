import { NextRequest, NextResponse } from "next/server";
import { updateOrganization } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { requireOrganizationAccess } from "@/lib/authorization";
import { logOrganizationUpdated } from "@/lib/audit";
import { ORGANIZATION_CONFIG } from "@/lib/config/constants";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { isPlainObject, readOptionalString, requireObject } from "@/lib/utils/input";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/organizations/[id]
 * Organization details plus the caller's role. Members only.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { organization, role } = requireOrganizationAccess(auth.authContext, id, "read");
    return successResponse({ ...organization, role });
  } catch (error) {
    return handleRouteError(error, "GET /api/organizations/[id]");
  }
}

/**
 * PUT /api/organizations/[id]
 * Body: { name?, description?, settings?: object }. Owners and admins only.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { organization, role } = requireOrganizationAccess(authContext, id, "manage");
    const body = requireObject(await readJsonBody(request));

    const name = readOptionalString(body, "name", "Organization name", {
      min: ORGANIZATION_CONFIG.NAME_MIN_LENGTH,
      max: ORGANIZATION_CONFIG.NAME_MAX_LENGTH,
    });
    if (name === "") throw new ValidationError("Organization name cannot be empty");
    const description = readOptionalString(body, "description", "Description", {
      max: ORGANIZATION_CONFIG.DESCRIPTION_MAX_LENGTH,
    });
    const settings = body.settings ?? undefined;
    if (settings !== undefined && !isPlainObject(settings)) {
      throw new ValidationError("Settings must be an object");
    }

    const changes: Record<string, unknown> = {};
    if (name !== undefined && name !== organization.name) {
      changes.name = { from: organization.name, to: name };
    }
    if (description !== undefined && description !== (organization.description ?? "")) {
      changes.description = "updated";
    }
    if (settings !== undefined) changes.settings = "updated";

    if (Object.keys(changes).length === 0) {
      return successResponse({ ...organization, role });
    }

    const updated = updateOrganization(id, { name, description, settings });
    if (!updated) throw new NotFoundError("Organization");

    logOrganizationUpdated(authContext.user.id, id, updated.name, changes);

    return successResponse({ ...updated, role });
  } catch (error) {
    return handleRouteError(error, "PUT /api/organizations/[id]");
  }
}
