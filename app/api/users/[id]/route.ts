import { NextRequest, NextResponse } from "next/server";
import { deleteUser, getDb, getUserById } from "@/lib/db";
import {
  handleRouteError,
  requirePlatformAdmin,
  successResponse,
} from "@/lib/middleware";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/rate-limit";
import { AuditAction, AuditResource, UserRole } from "@/lib/types";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";

/**
 * Users who own organizations or organization projects cannot be deleted:
 * the foreign keys cascade and would take shared data down with them.
 */
function assertNoSharedOwnership(userId: string): void {
  const database = getDb();
  const ownedOrganizations = database
    .prepare("SELECT COUNT(*) AS count FROM organizations WHERE owner_id = ?")
    .get(userId) as { count: number };
  if (ownedOrganizations.count > 0) {
    throw new ConflictError("Transfer this user's organizations to another owner before deleting them");
  }

  const ownedSharedProjects = database
    .prepare("SELECT COUNT(*) AS count FROM projects WHERE owner_id = ? AND organization_id IS NOT NULL")
    .get(userId) as { count: number };
  if (ownedSharedProjects.count > 0) {
    throw new ConflictError(
      "This user owns organization projects; delete or reassign them before deleting the user"
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Deletes a user and their personal projects (platform admins only).
 * Platform admins and the caller themselves cannot be deleted here.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const { id } = await params;

    if (id === authContext.user.id) {
      throw new ValidationError("You cannot delete your own account here");
    }

    const user = getUserById(id);
    if (!user) throw new NotFoundError("User");
    if (user.role === UserRole.PLATFORM_ADMIN) {
      throw new ValidationError("Platform admin accounts cannot be deleted");
    }
    assertNoSharedOwnership(id);

    if (!deleteUser(id)) throw new NotFoundError("User");

    logAudit({
      ...getRequestMeta(request.headers),
      userId: authContext.user.id,
      action: AuditAction.DELETED,
      resourceType: AuditResource.USER,
      resourceId: id,
      details: { username: user.username, email: user.email },
    });

    return successResponse({ id });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/users/[id]");
  }
}
