import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { isPlatformAdmin, requireOrganizationAccess } from "@/lib/authorization";
import {
  getActivityStats,
  getAuditLog,
  getMemberActivitySummary,
  searchAuditLogs,
} from "@/lib/audit";
import { countAuditLogs } from "@/lib/db";
import { AUDIT_CONFIG } from "@/lib/config/constants";
import { AuthorizationError, ValidationError } from "@/lib/utils/errors";
import { parseIntegerParam } from "@/lib/utils/input";

const MAX_FILTER_LENGTH = 100;

/**
 * GET /api/organizations/[id]/audit
 * Audit logs of an organization (owners and admins), or of the whole platform
 * when id is "all" (platform admins only).
 * Query: action, resourceType, userId, limit, offset, search, stats=true
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const isAllOrganizations = id === "all";

    if (isAllOrganizations) {
      if (!isPlatformAdmin(authContext)) {
        throw new AuthorizationError("Platform admin access required");
      }
    } else {
      requireOrganizationAccess(authContext, id, "manage");
    }

    const { searchParams } = request.nextUrl;
    const filter = (key: string) => {
      const value = searchParams.get(key)?.trim();
      if (value && value.length > MAX_FILTER_LENGTH) {
        throw new ValidationError(`${key} must not exceed ${MAX_FILTER_LENGTH} characters`);
      }
      return value || undefined;
    };

    const action = filter("action");
    const resourceType = filter("resourceType");
    const userId = filter("userId");
    const search = filter("search");
    const limit = parseIntegerParam(searchParams.get("limit"), AUDIT_CONFIG.DEFAULT_LIMIT, {
      min: 1,
      max: AUDIT_CONFIG.MAX_LIMIT,
    });
    const offset = parseIntegerParam(searchParams.get("offset"), 0, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
    const organizationId = isAllOrganizations ? undefined : id;

    if (searchParams.get("stats") === "true" && organizationId) {
      return successResponse({
        stats: getActivityStats(organizationId),
        memberActivity: getMemberActivitySummary(organizationId),
      });
    }

    if (search && organizationId) {
      const logs = searchAuditLogs(organizationId, search, limit);
      return successResponse({ logs, total: logs.length });
    }

    const logs = getAuditLog({ organizationId, action, resourceType, userId, limit, offset });
    const total = countAuditLogs({ organizationId, action, resourceType, userId });

    return successResponse({
      logs,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/organizations/[id]/audit");
  }
}
