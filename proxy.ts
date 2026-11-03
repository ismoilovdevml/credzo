import { NextResponse, type NextRequest } from "next/server";
import { SESSION_CONFIG } from "@/lib/config/constants";

/**
 * Request edge (Next.js 16 "proxy", formerly middleware).
 *
 * Page routing (optimistic, cookie-presence only; API routes and the dashboard
 * still validate the session server-side):
 *   - "/" and /s/* (public secure-share pages) are untouched.
 *   - /dashboard/* without a session cookie → /login?next=<path>.
 *   - /login and /signup with a session cookie → ?next target or /dashboard.
 *
 * CSRF: state-changing /api requests (anything but GET/HEAD/OPTIONS) are rejected
 * when the browser marks them cross-site, i.e. when the Origin header names a
 * different host than the request (Host or X-Forwarded-Host), Origin is "null",
 * or Sec-Fetch-Site is "cross-site". Requests without Origin (curl, server-to-server)
 * are allowed; they cannot carry a victim's cookies through a browser. This
 * complements the SameSite=Lax session cookie.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_PAGES = new Set(["/login", "/signup"]);

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim().toLowerCase() || null;
}

function isCrossSiteRequest(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (origin === null) return false;
  if (origin === "null") return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return true;
  }

  const allowedHosts = [
    firstHeaderValue(request.headers.get("host")),
    firstHeaderValue(request.headers.get("x-forwarded-host")),
  ];
  return !allowedHosts.includes(originHost);
}

/** Only same-site, absolute-path redirect targets are honoured. */
function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (!SAFE_METHODS.has(request.method) && isCrossSiteRequest(request)) {
      return NextResponse.json(
        { success: false, error: "Cross-origin request blocked" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_CONFIG.COOKIE_NAME);

  if ((pathname === "/dashboard" || pathname.startsWith("/dashboard/")) && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PAGES.has(pathname) && hasSession) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next ?? "/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard", "/dashboard/:path*", "/login", "/signup"],
};
