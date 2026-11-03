import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { isPlatformAdmin, requireOrganizationAccess } from "@/lib/authorization";
import { getActivityStats, getMemberActivitySummary } from "@/lib/audit";
import { countAuditLogs, getAuditLogs, type AuditLogFilters } from "@/lib/db";
import { AUDIT_CONFIG } from "@/lib/config/constants";
import { AuthorizationError, ValidationError } from "@/lib/utils/errors";
import { parseIntegerParam } from "@/lib/utils/input";

const MAX_FILTER_LENGTH = 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalizes an ISO date or date-time to a full ISO timestamp. A bare date
 * (YYYY-MM-DD, UTC) as the upper bound covers that whole day.
 */
function parseDateParam(key: string, value: string | undefined, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  const date = new Date(endOfDay && DATE_ONLY.test(value) ? time + DAY_MS - 1 : time);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${key} must be an ISO 8601 date`);
  return date.toISOString();
}

/**
 * GET /api/organizations/[id]/audit
 * Audit logs of an organization (owners and admins), or of the whole platform
 * when id is "all" (platform admins only).
 * Query (all combinable): action, resourceType, resourceId, userId, search,
 * from / to (ISO dates, inclusive), limit, offset; or stats=true.
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

    const filters: AuditLogFilters = {
      organizationId: isAllOrganizations ? undefined : id,
      action: filter("action"),
      resourceType: filter("resourceType"),
      resourceId: filter("resourceId"),
      userId: filter("userId"),
      search: filter("search"),
      since: parseDateParam("from", filter("from"), false),
      until: parseDateParam("to", filter("to"), true),
    };
    const limit = parseIntegerParam(searchParams.get("limit"), AUDIT_CONFIG.DEFAULT_LIMIT, {
      min: 1,
      max: AUDIT_CONFIG.MAX_LIMIT,
    });
    const offset = parseIntegerParam(searchParams.get("offset"), 0, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });

    if (searchParams.get("stats") === "true" && filters.organizationId) {
      return successResponse({
        stats: getActivityStats(filters.organizationId),
        memberActivity: getMemberActivitySummary(filters.organizationId),
      });
    }

    const logs = getAuditLogs({ ...filters, limit, offset });
    const total = countAuditLogs(filters);

    return successResponse({
      logs,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/organizations/[id]/audit");
  }
}
