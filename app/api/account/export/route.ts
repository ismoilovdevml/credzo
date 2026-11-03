import { NextRequest } from "next/server";
import { getAccessibleProjects } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { getRequestMeta } from "@/lib/rate-limit";
import type { ExportData } from "@/lib/types";
import { AuditAction, AuditResource } from "@/lib/types";

const EXPORT_FORMAT_VERSION = "2";

/**
 * GET /api/account/export → { success, data: ExportData }
 * Decrypted projects + credentials the user can access (owned, organization
 * member, or project member). The client encrypts the file (lib/crypto.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user, organization } = auth.authContext;

    const projects = getAccessibleProjects(user.id);
    const exportData: ExportData = {
      type: "full",
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      projects,
    };

    const { ipAddress, userAgent } = getRequestMeta(request.headers);
    logAudit({
      userId: user.id,
      organizationId: organization?.id,
      action: AuditAction.EXPORTED,
      resourceType: AuditResource.ACCOUNT,
      resourceId: user.id,
      details: {
        projectCount: projects.length,
        credentialCount: projects.reduce((total, project) => total + project.credentials.length, 0),
      },
      ipAddress,
      userAgent,
    });

    return successResponse(exportData);
  } catch (error) {
    return handleRouteError(error, "GET /api/account/export");
  }
}
