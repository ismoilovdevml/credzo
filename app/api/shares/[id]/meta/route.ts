import { NextRequest } from "next/server";
import {
  handleRouteError,
  successResponse,
  errorResponse,
} from "@/lib/middleware";
import { clientRateKey } from "@/lib/rate-limit";
import { consumeRateLimit, getShareMeta, isValidShareId } from "@/lib/shares";

const META_LIMIT_PER_MINUTE = 60;

// GET /api/shares/[id]/meta - Public link status; never consumes a view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const retryAfter = consumeRateLimit(
      `share-meta:${clientRateKey(request.headers, id)}`,
      META_LIMIT_PER_MINUTE,
      60_000
    );
    if (retryAfter > 0) {
      const limited = errorResponse("Too many requests. Try again shortly.", 429);
      limited.headers.set("Retry-After", String(retryAfter));
      return limited;
    }

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
