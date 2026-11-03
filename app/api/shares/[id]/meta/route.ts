import { NextRequest } from "next/server";
import {
  handleRouteError,
  successResponse,
  errorResponse,
  getClientIp,
} from "@/lib/middleware";
import { consumeRateLimit, getShareMeta, isValidShareId } from "@/lib/shares";

const META_LIMIT_PER_MINUTE = 60;

// GET /api/shares/[id]/meta - Public link status; never consumes a view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const retryAfter = consumeRateLimit(
      `share-meta:${getClientIp(request)}`,
      META_LIMIT_PER_MINUTE,
      60_000
    );
    if (retryAfter > 0) {
      const limited = errorResponse("Too many requests. Try again shortly.", 429);
      limited.headers.set("Retry-After", String(retryAfter));
      return limited;
    }

    const { id } = await params;
    const meta = isValidShareId(id)
      ? getShareMeta(id)
      : ({ exists: false, reason: "not_found" } as const);

    const response = successResponse(meta);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return handleRouteError(error, "shares:meta");
  }
}
