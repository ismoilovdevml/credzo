import { NextRequest } from "next/server";
import {
  handleRouteError,
  successResponse,
  errorResponse,
  getUserAgent,
} from "@/lib/middleware";
import { logAudit } from "@/lib/audit";
import { clientRateKey, getRequestIp } from "@/lib/rate-limit";
import {
  SHARE_AUDIT_ACTIONS,
  SHARE_AUDIT_RESOURCE,
  consumeRateLimit,
  isValidShareId,
  openShare,
} from "@/lib/shares";

const OPEN_LIMIT_PER_MINUTE = 30;

const UNAVAILABLE_MESSAGES = {
  expired: "This link has expired",
  revoked: "This link was revoked by its owner",
  consumed: "This link has already been opened",
} as const;

// POST /api/shares/[id]/open - Public: consume one view, return the ciphertext
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const retryAfter = consumeRateLimit(
      `share-open:${clientRateKey(request.headers, id)}`,
      OPEN_LIMIT_PER_MINUTE,
      60_000
    );
    if (retryAfter > 0) {
      const limited = errorResponse("Too many requests. Try again shortly.", 429);
      limited.headers.set("Retry-After", String(retryAfter));
      return limited;
    }

    if (!isValidShareId(id)) {
      return errorResponse("Link not found", 404, "not_found");
    }

    const result = openShare(id);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return errorResponse("Link not found", 404, "not_found");
      }
      return errorResponse(UNAVAILABLE_MESSAGES[result.reason], 410, result.reason);
    }

    // Recorded against the owner: recipients are anonymous by design.
    logAudit({
      organizationId: result.organizationId ?? undefined,
      userId: result.ownerId,
      action: SHARE_AUDIT_ACTIONS.OPENED,
      resourceType: SHARE_AUDIT_RESOURCE,
      resourceId: id,
      details: { viewsLeft: result.payload.viewsLeft },
      ipAddress: getRequestIp(request.headers),
      userAgent: getUserAgent(request),
    });

    const response = successResponse(result.payload);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return handleRouteError(error, "shares:open");
  }
}
