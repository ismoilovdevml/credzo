import { NextRequest, NextResponse } from "next/server";
import { deleteService, getServiceById, updateService } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { type ProjectAccessLevel, requireProjectAccess } from "@/lib/authorization";
import type { AuthContext } from "@/lib/types";
import { NotFoundError } from "@/lib/utils/errors";
import { requireObject } from "@/lib/utils/input";
import { parseServicePatch } from "@/lib/utils/service-input";

type RouteContext = { params: Promise<{ id: string; serviceId: string }> };

/** Resolve a service that belongs to the given project, after checking project access. */
function requireProjectService(
  context: AuthContext,
  projectId: string,
  serviceId: string,
  level: ProjectAccessLevel
) {
  const { project } = requireProjectAccess(context, projectId, level);
  const service = getServiceById(serviceId);
  if (!service || service.projectId !== project.id) throw new NotFoundError("Service");
  return service;
}

/**
 * GET /api/projects/[id]/services/[serviceId]
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, serviceId } = await params;
    return successResponse(requireProjectService(auth.authContext, id, serviceId, "read"));
  } catch (error) {
    return handleRouteError(error, "GET /api/projects/[id]/services/[serviceId]");
  }
}

/**
 * PATCH /api/projects/[id]/services/[serviceId]
 * Body: { name?, description?, url?, tags? }. Requires editor access.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id, serviceId } = await params;
    const service = requireProjectService(authContext, id, serviceId, "edit");
    const input = parseServicePatch(requireObject(await readJsonBody(request)));

    const updated = updateService(service.id, input, authContext.user.id);
    if (!updated) throw new NotFoundError("Service");
    return successResponse(updated);
  } catch (error) {
    return handleRouteError(error, "PATCH /api/projects/[id]/services/[serviceId]");
  }
}

/**
 * DELETE /api/projects/[id]/services/[serviceId]
 * Requires editor access.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, serviceId } = await params;
    const service = requireProjectService(auth.authContext, id, serviceId, "edit");

    if (!deleteService(service.id)) throw new NotFoundError("Service");
    return successResponse({ id: service.id });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/projects/[id]/services/[serviceId]");
  }
}
