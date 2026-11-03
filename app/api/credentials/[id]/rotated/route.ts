import { NextRequest, NextResponse } from "next/server";
import { updateCredential } from "@/lib/db";
import { handleRouteError, requireAuth, successResponse } from "@/lib/middleware";
import { requireCredentialAccess } from "@/lib/authorization";
import { logCredentialRotated } from "@/lib/audit";
import { getRequestMeta } from "@/lib/rate-limit";
import { toCredentialView } from "@/lib/utils/credentials";
import { NotFoundError } from "@/lib/utils/errors";

/**
 * POST /api/credentials/[id]/rotated
 * Records that the secret was rotated outside Credzo: sets lastRotatedAt to now.
 * Requires editor access. Returns the updated CredentialView.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { project } = requireCredentialAccess(authContext, id, "edit");

    const credential = updateCredential(id, { lastRotatedAt: new Date().toISOString() }, authContext.user.id);
    if (!credential) throw new NotFoundError("Credential");

    logCredentialRotated(
      getRequestMeta(request.headers),
      authContext.user.id,
      credential.id,
      credential.name,
      project.organizationId ?? undefined
    );

    return successResponse(toCredentialView(credential, project));
  } catch (error) {
    return handleRouteError(error, "POST /api/credentials/[id]/rotated");
  }
}
