import { NextRequest } from "next/server";
import { countActiveSessions, getAdminStats, getDatabaseSize } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/auth";
import { getEncryptionKeyInfo } from "@/lib/crypto-server";
import { errorResponse, handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { HTTP_STATUS } from "@/lib/config/constants";
import type { AdminStats, StatsRange } from "@/lib/types";
import { OrganizationRole, STATS_RANGES } from "@/lib/types";
import { ValidationError } from "@/lib/utils/errors";
import packageJson from "@/package.json";

/**
 * GET /api/admin/stats?range=24h|7d|30d (default 7d) → { success, data: AdminStats }
 * Platform admins see the whole platform; organization owners/admins see their
 * active organization. Everyone else gets 403.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, organization, organizationRole } = auth.authContext;

    const rangeParam = request.nextUrl.searchParams.get("range") ?? "7d";
    if (!(STATS_RANGES as readonly string[]).includes(rangeParam)) {
      throw new ValidationError(`Range must be one of: ${STATS_RANGES.join(", ")}`);
    }
    const range = rangeParam as StatsRange;

    let organizationId: string | null = null;
    if (!isPlatformAdmin(user)) {
      const isOrgAdmin = organizationRole === OrganizationRole.OWNER || organizationRole === OrganizationRole.ADMIN;
      if (!organization || !isOrgAdmin) {
        return errorResponse("Organization owner or admin access required", HTTP_STATUS.FORBIDDEN);
      }
      organizationId = organization.id;
    }

    const stats: AdminStats = {
      ...getAdminStats(range, organizationId),
      system: {
        dbSizeBytes: getDatabaseSize(),
        encryptionKeySource: getEncryptionKeyInfo().source,
        activeSessions: countActiveSessions(),
        version: packageJson.version,
      },
    };

    return successResponse(stats);
  } catch (error) {
    return handleRouteError(error, "GET /api/admin/stats");
  }
}
