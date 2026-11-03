import { NextRequest } from "next/server";
import { setActiveOrganizationCookie } from "@/lib/auth";
import { errorResponse, handleRouteError, readJsonBody, requireAuth, successResponse } from "@/lib/middleware";
import { HTTP_STATUS } from "@/lib/config/constants";
import { readRequiredString, requireObject } from "@/lib/utils/input";

/**
 * POST /api/auth/active-organization
 * Body: { organizationId } - must be one of the user's organizations.
 * 200 { success, data: { organizationId } } and sets the active_org cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;

    const body = requireObject(await readJsonBody(request));
    const organizationId = readRequiredString(body, "organizationId", "Organization", { max: 128 });

    if (!auth.authContext.organizations.some((org) => org.id === organizationId)) {
      return errorResponse("You are not a member of this organization", HTTP_STATUS.FORBIDDEN);
    }

    const response = successResponse({ organizationId });
    setActiveOrganizationCookie(response, organizationId);
    return response;
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/active-organization");
  }
}
