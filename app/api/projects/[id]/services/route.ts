import { NextRequest, NextResponse } from "next/server";
import { createService, getProjectServices } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { requireProjectAccess } from "@/lib/authorization";
import { requireObject } from "@/lib/utils/input";
import { parseServiceCreate } from "@/lib/utils/service-input";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/services
 * Services of a project. Any project role may read.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { project } = requireProjectAccess(auth.authContext, id, "read");
    return successResponse(getProjectServices(project.id));
  } catch (error) {
    return handleRouteError(error, "GET /api/projects/[id]/services");
  }
}

/**
 * POST /api/projects/[id]/services
 * Body: { name, description?, url?, tags? }. Requires editor access.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { project } = requireProjectAccess(authContext, id, "edit");
    const input = parseServiceCreate(requireObject(await readJsonBody(request)));

    const service = createService(project.id, input, authContext.user.id);
    return successResponse(service, 201);
  } catch (error) {
    return handleRouteError(error, "POST /api/projects/[id]/services");
  }
}
