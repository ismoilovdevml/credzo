import { NextRequest } from "next/server";
import { clearSessionCookie, logout, SESSION_COOKIE_NAME } from "@/lib/auth";
import { handleRouteError, successResponse } from "@/lib/middleware";
import { getRequestMeta } from "@/lib/rate-limit";

/**
 * POST /api/auth/logout
 * Ends the current session (if any) and clears the cookie. Always 200.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) logout(token, getRequestMeta(request.headers));

    const response = successResponse({ loggedOut: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/logout");
  }
}
