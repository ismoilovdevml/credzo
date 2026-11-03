import { NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_ORG_COOKIE_NAME,
  clearSessionCookie,
  isPersistentSession,
  isPlatformAdmin,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  toPublicUser,
  validateSession,
} from "@/lib/auth";
import { errorResponse, handleRouteError } from "@/lib/middleware";
import { ERROR_MESSAGES, HTTP_STATUS } from "@/lib/config/constants";

/**
 * GET /api/auth/session
 * 200 { success, user, organization, organizationRole, organizations, permissions, isPlatformAdmin }
 * Also re-issues a persistent session cookie so its lifetime slides with use.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const authContext = token
      ? await validateSession(token, { activeOrganizationId: request.cookies.get(ACTIVE_ORG_COOKIE_NAME)?.value })
      : null;

    if (!token || !authContext) {
      const response = errorResponse(ERROR_MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      if (token) clearSessionCookie(response);
      return response;
    }

    const { organization } = authContext;
    const response = NextResponse.json(
      {
        success: true,
        user: toPublicUser(authContext.user),
        organization: organization
          ? { id: organization.id, name: organization.name, slug: organization.slug, description: organization.description }
          : null,
        organizationRole: authContext.organizationRole ?? null,
        organizations: authContext.organizations,
        permissions: authContext.permissions,
        isPlatformAdmin: isPlatformAdmin(authContext.user),
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    if (isPersistentSession(token)) setSessionCookie(response, token, true);
    return response;
  } catch (error) {
    return handleRouteError(error, "GET /api/auth/session");
  }
}
