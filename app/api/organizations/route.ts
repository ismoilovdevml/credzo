import { NextRequest, NextResponse } from "next/server";
import { getUserOrganizations } from "@/lib/db";
import { handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { loadAccessScope } from "@/lib/authorization";

/**
 * GET /api/organizations
 * Organizations the caller belongs to, each with the caller's role.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { organizationRoles } = loadAccessScope(authContext);
    const organizations = getUserOrganizations(authContext.user.id).map((organization) => ({
      ...organization,
      role: organizationRoles.get(organization.id) ?? null,
    }));

    return successResponse(organizations);
  } catch (error) {
    return handleRouteError(error, "GET /api/organizations");
  }
}
