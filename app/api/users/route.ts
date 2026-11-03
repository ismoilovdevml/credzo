import { NextRequest, NextResponse } from "next/server";
import { getAllUsers } from "@/lib/db";
import { handleRouteError, requirePlatformAdmin, successResponse } from "@/lib/middleware";

/**
 * GET /api/users
 * Every user on the platform (platform admins only), shaped like organization
 * members so the UI can render both lists the same way.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const users = getAllUsers().map((user) => ({
      id: user.id,
      userId: user.id,
      role: null,
      platformRole: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin ?? null,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    }));

    return successResponse(users);
  } catch (error) {
    return handleRouteError(error, "GET /api/users");
  }
}
