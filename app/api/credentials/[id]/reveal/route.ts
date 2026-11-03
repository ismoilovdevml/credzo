import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/db";
import {
  getClientIp,
  getUserAgent,
  handleRouteError,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { requireCredentialAccess } from "@/lib/authorization";
import { logCredentialAccessed } from "@/lib/audit";
import { getSecretFieldValues } from "@/lib/utils/credentials";
import { NotFoundError } from "@/lib/utils/errors";

/**
 * POST /api/credentials/[id]/reveal
 * Returns the decrypted secret field values of a credential and records an
 * "accessed" audit event. Any project role (viewer included) may reveal.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { project } = requireCredentialAccess(authContext, id, "read");

    const credential = getCredentialById(id);
    if (!credential) throw new NotFoundError("Credential");

    logCredentialAccessed(
      authContext.user.id,
      credential.id,
      credential.name,
      credential.type,
      project.id,
      project.organizationId ?? undefined,
      getClientIp(request),
      getUserAgent(request)
    );

    return successResponse({ id: credential.id, fields: getSecretFieldValues(credential) });
  } catch (error) {
    return handleRouteError(error, "POST /api/credentials/[id]/reveal");
  }
}
