import { NextRequest } from "next/server";
import { getUserByEmail, getUserByUsername, updateUser } from "@/lib/db";
import { toPublicUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { handleRouteError, readJsonBody, requireAuth, successResponse } from "@/lib/middleware";
import { getRequestMeta } from "@/lib/rate-limit";
import { ERROR_MESSAGES, INVITATION_CONFIG, REGEX_PATTERNS } from "@/lib/config/constants";
import { readOptionalString, requireObject } from "@/lib/utils/input";
import { ConflictError, ValidationError } from "@/lib/utils/errors";
import type { User } from "@/lib/types";
import { AuditAction, AuditResource } from "@/lib/types";

/** GET /api/user-profile → { success, data: PublicUser } */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    return successResponse(toPublicUser(auth.authContext.user));
  } catch (error) {
    return handleRouteError(error, "GET /api/user-profile");
  }
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * PATCH /api/user-profile
 * Body (all optional): { firstName, lastName, username, email, jobTitle, timezone }
 * jobTitle / timezone accept "" or null to clear. → { success, data: PublicUser }
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!("authContext" in auth)) return auth;
    const { user } = auth.authContext;

    const body = requireObject(await readJsonBody(request));
    const updates: Partial<User> = {};

    const firstName = readOptionalString(body, "firstName", "First name", { max: 50 });
    if (firstName !== undefined) {
      if (!firstName) throw new ValidationError("First name is required");
      updates.firstName = firstName;
    }

    const lastName = readOptionalString(body, "lastName", "Last name", { max: 50 });
    if (lastName !== undefined) {
      if (!lastName) throw new ValidationError("Last name is required");
      updates.lastName = lastName;
    }

    const username = readOptionalString(body, "username", "Username", { min: 3, max: 32 });
    if (username !== undefined && username !== user.username) {
      if (!REGEX_PATTERNS.USERNAME.test(username)) {
        throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_USERNAME);
      }
      const owner = getUserByUsername(username);
      if (owner && owner.id !== user.id) throw new ConflictError("Username is already taken");
      updates.username = username;
    }

    const email = readOptionalString(body, "email", "Email", { max: INVITATION_CONFIG.EMAIL_MAX_LENGTH });
    if (email !== undefined && email.toLowerCase() !== user.email.toLowerCase()) {
      const normalized = email.toLowerCase();
      if (!REGEX_PATTERNS.EMAIL.test(normalized)) throw new ValidationError("Email is not a valid email address");
      const owner = getUserByEmail(normalized);
      if (owner && owner.id !== user.id) throw new ConflictError("An account with this email already exists");
      updates.email = normalized;
    }

    const jobTitle = readOptionalString(body, "jobTitle", "Job title", { max: 100 });
    if (jobTitle !== undefined || body.jobTitle === null) updates.jobTitle = jobTitle ?? "";

    const timezone = readOptionalString(body, "timezone", "Timezone", { max: 64 });
    if (timezone !== undefined || body.timezone === null) {
      if (timezone && !isValidTimezone(timezone)) throw new ValidationError("Timezone is not a valid IANA time zone");
      updates.timezone = timezone ?? "";
    }

    const changedFields = Object.keys(updates);
    if (changedFields.length === 0) return successResponse(toPublicUser(user));

    const updated = updateUser(user.id, updates);
    if (!updated) throw new Error("User disappeared during profile update");

    const { ipAddress, userAgent } = getRequestMeta(request.headers);
    logAudit({
      userId: user.id,
      organizationId: auth.authContext.organization?.id,
      action: AuditAction.UPDATED,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      details: { changes: changedFields },
      ipAddress,
      userAgent,
    });

    return successResponse(toPublicUser(updated));
  } catch (error) {
    return handleRouteError(error, "PATCH /api/user-profile");
  }
}

/** Alias kept for clients that still send PUT. */
export const PUT = PATCH;
