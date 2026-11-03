import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  readJsonBody,
  handleRouteError,
  successResponse,
  errorResponse,
  getClientIp,
  getUserAgent,
} from "@/lib/middleware";
import { logAudit } from "@/lib/audit";
import {
  MAX_ACTIVE_SHARES_PER_USER,
  MAX_SHARE_REQUEST_BYTES,
  SHARE_AUDIT_ACTIONS,
  SHARE_AUDIT_RESOURCE,
  countActiveShares,
  createShare,
  listSharesForUser,
  parseCreateShareInput,
} from "@/lib/shares";

// GET /api/shares - List the current user's one-time links (never ciphertext)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    return successResponse(listSharesForUser(authResult.authContext.user.id));
  } catch (error) {
    return handleRouteError(error, "shares:list");
  }
}

// POST /api/shares - Store a client-side encrypted secret behind a one-time link
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { authContext } = authResult;
    const body = await readJsonBody(request, MAX_SHARE_REQUEST_BYTES);

    const parsed = parseCreateShareInput(body);
    if (!parsed.ok) {
      return errorResponse(parsed.error, 400);
    }

    if (countActiveShares(authContext.user.id) >= MAX_ACTIVE_SHARES_PER_USER) {
      return errorResponse(
        `You can have at most ${MAX_ACTIVE_SHARES_PER_USER} active links. Revoke some first.`,
        429
      );
    }

    const organizationId = authContext.organization?.id ?? null;
    const share = createShare(authContext.user.id, organizationId, parsed.value);

    logAudit({
      organizationId: organizationId ?? undefined,
      userId: authContext.user.id,
      action: SHARE_AUDIT_ACTIONS.CREATED,
      resourceType: SHARE_AUDIT_RESOURCE,
      resourceId: share.id,
      details: {
        label: parsed.value.label,
        maxViews: parsed.value.maxViews,
        expiresIn: parsed.value.expiresIn,
        requiresPassphrase: parsed.value.requiresPassphrase,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return successResponse(share, 201);
  } catch (error) {
    return handleRouteError(error, "shares:create");
  }
}
