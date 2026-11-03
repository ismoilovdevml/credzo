import { NextRequest, NextResponse } from "next/server";
import { deleteCredential, getCredentialById, updateCredential } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { requireCredentialAccess } from "@/lib/authorization";
import { logCredentialDeleted, logCredentialUpdated } from "@/lib/audit";
import type { Credential } from "@/lib/types";
import { mergeFields, parseCredentialPatch, toCredentialView } from "@/lib/utils/credentials";
import { NotFoundError } from "@/lib/utils/errors";
import { requireObject } from "@/lib/utils/input";

type RouteContext = { params: Promise<{ id: string }> };

function loadCredential(id: string): Credential {
  const credential = getCredentialById(id);
  if (!credential) throw new NotFoundError("Credential");
  return credential;
}

/**
 * GET /api/credentials/[id]
 * Credential detail with secret fields masked (see POST /reveal).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { project, role } = requireCredentialAccess(auth.authContext, id, "read");
    const credential = loadCredential(id);

    return successResponse({
      ...toCredentialView(credential, project.id),
      projectName: project.name,
      currentUserRole: role,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/credentials/[id]");
  }
}

/**
 * PATCH /api/credentials/[id]
 * Partial update. `fields` is merged into the stored fields: a value sets a field,
 * null removes it, and omitted fields (including unrevealed secrets) are kept.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { project } = requireCredentialAccess(authContext, id, "edit");
    const patch = parseCredentialPatch(requireObject(await readJsonBody(request)));
    const existing = loadCredential(id);

    const { fields: fieldPatch, ...rest } = patch;
    const updates: Partial<Credential> = { ...rest };
    const changes: Record<string, unknown> = {};

    if (patch.name !== undefined && patch.name !== existing.name) {
      changes.name = { from: existing.name, to: patch.name };
    }
    for (const key of ["type", "description", "environment", "rotationDays"] as const) {
      if (patch[key] !== undefined && patch[key] !== (existing[key] ?? null)) changes[key] = "updated";
    }
    if (patch.linkedServers !== undefined) changes.linkedServers = "updated";

    if (fieldPatch) {
      updates.fields = mergeFields(existing.fields ?? {}, fieldPatch);
      changes.fields = "updated";
    }

    const credential = updateCredential(id, updates, authContext.user.id);
    if (!credential) throw new NotFoundError("Credential");

    if (Object.keys(changes).length > 0) {
      logCredentialUpdated(
        authContext.user.id,
        credential.id,
        credential.name,
        changes,
        project.organizationId ?? undefined
      );
    }

    return successResponse(toCredentialView(credential, project.id));
  } catch (error) {
    return handleRouteError(error, "PATCH /api/credentials/[id]");
  }
}

/** PUT is accepted as an alias of PATCH (same partial-update semantics). */
export const PUT = PATCH;

/**
 * DELETE /api/credentials/[id]
 * Requires editor access to the owning project.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;
    const { project } = requireCredentialAccess(authContext, id, "edit");
    const credential = loadCredential(id);

    if (!deleteCredential(id)) throw new NotFoundError("Credential");

    logCredentialDeleted(
      authContext.user.id,
      credential.id,
      credential.name,
      credential.type,
      project.organizationId ?? undefined
    );

    return successResponse({ id: credential.id });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/credentials/[id]");
  }
}
