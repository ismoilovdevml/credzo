import { createAuditLog, getAuditLogs } from "./db";
import type { AuditLog } from "./types";
import { AuditAction, AuditResource } from "./types";

/**
 * Audit logging service for tracking all important actions
 */

export interface AuditLogData {
  organizationId?: string | null;
  /** null when there is no known actor (e.g. a failed sign-in for an unknown username). */
  userId: string | null;
  action: AuditAction | string;
  resourceType: AuditResource | string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event
 */
export function logAudit(data: AuditLogData): void {
  try {
    createAuditLog(data);
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // Don't throw - audit logging should not break app functionality
  }
}

/**
 * Log project creation
 */
export function logProjectCreated(
  userId: string,
  projectId: string,
  projectName: string,
  organizationId?: string,
  metadata?: Record<string, unknown>
): void {
  logAudit({
    organizationId,
    userId,
    action: AuditAction.CREATED,
    resourceType: AuditResource.PROJECT,
    resourceId: projectId,
    details: {
      projectName,
      ...metadata,
    },
  });
}

/**
 * Log project update
 */
export function logProjectUpdated(
  userId: string,
  projectId: string,
  projectName: string,
  changes: Record<string, unknown>,
  organizationId?: string
): void {
  logAudit({
    organizationId,
    userId,
    action: AuditAction.UPDATED,
    resourceType: AuditResource.PROJECT,
    resourceId: projectId,
    details: {
      projectName,
      changes,
    },
  });
}

/**
 * Log project deletion
 */
export function logProjectDeleted(
  userId: string,
  projectId: string,
  projectName: string,
  organizationId?: string
): void {
  logAudit({
    organizationId,
    userId,
    action: AuditAction.DELETED,
    resourceType: AuditResource.PROJECT,
    resourceId: projectId,
    details: {
      projectName,
    },
  });
}

/**
 * Log credential creation
 */
export function logCredentialCreated(
  userId: string,
  credentialId: string,
  credentialName: string,
  credentialType: string,
  projectId: string,
  organizationId?: string
): void {
  logAudit({
    organizationId,
    userId,
    action: AuditAction.CREATED,
    resourceType: AuditResource.CREDENTIAL,
    resourceId: credentialId,
    details: {
      credentialName,
      credentialType,
      projectId,
    },
  });
}

/**
 * Log credential access (view/read)
 */
export function logCredentialAccessed(
  userId: string,
  credentialId: string,
  credentialName: string,
  credentialType: string,
  projectId: string,
  organizationId?: string,
  ipAddress?: string,
  userAgent?: string
): void {
  logAudit({
    organizationId,
    userId,
    action: AuditAction.ACCESSED,
    resourceType: AuditResource.CREDENTIAL,
    resourceId: credentialId,
    details: {
      credentialName,
      credentialType,
      projectId,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log credential update
 */
export function logCredentialUpdated(
  userId: string,
  credentialId: string,
  credentialName: string,
  changes: Record<string, unknown>,
  organizationId?: string
): void {
  logAudit({
    organizationId,
    userId,
    action: AuditAction.UPDATED,
    resourceType: AuditResource.CREDENTIAL,
    resourceId: credentialId,
    details: {
      credentialName,
      changes,
    },
  });
}

/**
 * Log credential deletion
 */
export function logCredentialDeleted(
  userId: string,
  credentialId: string,
  credentialName: string,
  credentialType: string,
  organizationId?: string
): void {
  logAudit({
    organizationId,
    userId,
    action: AuditAction.DELETED,
    resourceType: AuditResource.CREDENTIAL,
    resourceId: credentialId,
    details: {
      credentialName,
      credentialType,
    },
  });
}

/**
 * Log member invitation
 */
export function logMemberInvited(
  inviterId: string,
  organizationId: string,
  email: string,
  role: string
): void {
  logAudit({
    organizationId,
    userId: inviterId,
    action: AuditAction.INVITED,
    resourceType: AuditResource.MEMBER,
    details: {
      email,
      role,
    },
  });
}

/**
 * Log member removal
 */
export function logMemberRemoved(
  removerId: string,
  organizationId: string,
  removedUserId: string,
  removedUsername: string,
  role: string
): void {
  logAudit({
    organizationId,
    userId: removerId,
    action: AuditAction.REMOVED,
    resourceType: AuditResource.MEMBER,
    resourceId: removedUserId,
    details: {
      removedUsername,
      role,
    },
  });
}

/**
 * Log member role change
 */
export function logMemberRoleChanged(
  changerId: string,
  organizationId: string,
  targetUserId: string,
  targetUsername: string,
  oldRole: string,
  newRole: string
): void {
  logAudit({
    organizationId,
    userId: changerId,
    action: AuditAction.ROLE_CHANGED,
    resourceType: AuditResource.MEMBER,
    resourceId: targetUserId,
    details: {
      targetUsername,
      oldRole,
      newRole,
    },
  });
}

/**
 * Log project member added
 */
export function logProjectMemberAdded(
  organizationId: string,
  adderId: string,
  projectId: string,
  memberId: string,
  role: string
): void {
  logAudit({
    organizationId,
    userId: adderId,
    action: AuditAction.CREATED,
    resourceType: AuditResource.MEMBER,
    resourceId: memberId,
    details: {
      projectId,
      role,
      context: 'project_member',
    },
  });
}

/**
 * Log project member removed
 */
export function logProjectMemberRemoved(
  organizationId: string,
  removerId: string,
  projectId: string,
  memberId: string
): void {
  logAudit({
    organizationId,
    userId: removerId,
    action: AuditAction.REMOVED,
    resourceType: AuditResource.MEMBER,
    resourceId: memberId,
    details: {
      projectId,
      context: 'project_member',
    },
  });
}

/**
 * Log organization update
 */
export function logOrganizationUpdated(
  userId: string,
  organizationId: string,
  organizationName: string,
  changes: Record<string, unknown>
): void {
  logAudit({
    organizationId,
    userId,
    action: AuditAction.UPDATED,
    resourceType: AuditResource.ORGANIZATION,
    resourceId: organizationId,
    details: {
      organizationName,
      changes,
    },
  });
}

/**
 * Get audit logs with filters
 */
export function getAuditLog(filters?: {
  organizationId?: string;
  userId?: string;
  action?: AuditAction | string;
  resourceType?: AuditResource | string;
  limit?: number;
  offset?: number;
}): AuditLog[] {
  return getAuditLogs(filters);
}

/**
 * Get recent activity for organization
 */
export function getRecentOrganizationActivity(
  organizationId: string,
  limit: number = 50
): AuditLog[] {
  return getAuditLogs({
    organizationId,
    limit,
  });
}

/**
 * Get user activity
 */
export function getUserActivity(userId: string, limit: number = 50): AuditLog[] {
  return getAuditLogs({
    userId,
    limit,
  });
}

/**
 * Get activity by resource type
 */
export function getActivityByResourceType(
  organizationId: string,
  resourceType: AuditResource | string,
  limit: number = 50
): AuditLog[] {
  return getAuditLogs({
    organizationId,
    resourceType,
    limit,
  });
}

/**
 * Get activity statistics
 */
export function getActivityStats(organizationId: string): {
  totalActions: number;
  actionBreakdown: Record<string, number>;
  resourceBreakdown: Record<string, number>;
  recentActivity: AuditLog[];
} {
  const allLogs = getAuditLogs({ organizationId });

  const actionBreakdown: Record<string, number> = {};
  const resourceBreakdown: Record<string, number> = {};

  allLogs.forEach((log) => {
    actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
    resourceBreakdown[log.resourceType] = (resourceBreakdown[log.resourceType] || 0) + 1;
  });

  const recentActivity = getAuditLogs({
    organizationId,
    limit: 20,
  });

  return {
    totalActions: allLogs.length,
    actionBreakdown,
    resourceBreakdown,
    recentActivity,
  };
}

/**
 * Get member activity summary
 */
export function getMemberActivitySummary(organizationId: string): {
  userId: string;
  actionCount: number;
  lastActivity: string;
}[] {
  const logs = getAuditLogs({ organizationId });

  const userActivity: Record<
    string,
    { userId: string; actionCount: number; lastActivity: string }
  > = {};

  logs.forEach((log) => {
    if (!userActivity[log.userId]) {
      userActivity[log.userId] = {
        userId: log.userId,
        actionCount: 0,
        lastActivity: log.timestamp,
      };
    }
    userActivity[log.userId].actionCount++;
    if (log.timestamp > userActivity[log.userId].lastActivity) {
      userActivity[log.userId].lastActivity = log.timestamp;
    }
  });

  return Object.values(userActivity).sort((a, b) => b.actionCount - a.actionCount);
}

/**
 * Search audit logs
 */
export function searchAuditLogs(
  organizationId: string,
  searchTerm: string,
  limit: number = 50
): AuditLog[] {
  const logs = getAuditLogs({ organizationId, limit: 1000 });

  const lowerSearchTerm = searchTerm.toLowerCase();

  return logs
    .filter((log) => {
      const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : "";
      return (
        log.action.toLowerCase().includes(lowerSearchTerm) ||
        log.resourceType.toLowerCase().includes(lowerSearchTerm) ||
        (log.resourceId && log.resourceId.toLowerCase().includes(lowerSearchTerm)) ||
        detailsStr.includes(lowerSearchTerm)
      );
    })
    .slice(0, limit);
}

/**
 * Format audit log for display
 */
export function formatAuditLog(log: AuditLog): string {
  const action = log.action;
  const resourceType = log.resourceType;
  const details = log.details || {};

  switch (action) {
    case AuditAction.CREATED:
      if (resourceType === AuditResource.PROJECT) {
        return `Created project "${details.projectName}"`;
      }
      if (resourceType === AuditResource.CREDENTIAL) {
        return `Created ${details.credentialType} credential "${details.credentialName}"`;
      }
      break;

    case AuditAction.UPDATED:
      if (resourceType === AuditResource.PROJECT) {
        return `Updated project "${details.projectName}"`;
      }
      if (resourceType === AuditResource.CREDENTIAL) {
        return `Updated credential "${details.credentialName}"`;
      }
      if (resourceType === AuditResource.ORGANIZATION) {
        return `Updated organization "${details.organizationName}"`;
      }
      break;

    case AuditAction.DELETED:
      if (resourceType === AuditResource.PROJECT) {
        return `Deleted project "${details.projectName}"`;
      }
      if (resourceType === AuditResource.CREDENTIAL) {
        return `Deleted credential "${details.credentialName}"`;
      }
      break;

    case AuditAction.ACCESSED:
      if (resourceType === AuditResource.CREDENTIAL) {
        return `Accessed ${details.credentialType} credential "${details.credentialName}"`;
      }
      break;

    case AuditAction.INVITED:
      return `Invited ${details.email} as ${details.role}`;

    case AuditAction.REMOVED:
      return `Removed ${details.removedUsername} (${details.role})`;

    case AuditAction.ROLE_CHANGED:
      return `Changed ${details.targetUsername}'s role from ${details.oldRole} to ${details.newRole}`;

    case AuditAction.LOGIN:
      return `Logged in`;

    case AuditAction.LOGOUT:
      return `Logged out`;

    case AuditAction.LOGIN_FAILED:
      return `Failed sign-in for "${details.username}"`;

    case AuditAction.PASSWORD_CHANGED:
      return `Changed password`;

    case AuditAction.TWO_FACTOR_ENABLED:
      return `Enabled two-factor authentication`;

    case AuditAction.TWO_FACTOR_DISABLED:
      return `Disabled two-factor authentication`;

    case AuditAction.SESSION_REVOKED:
      return details.revokedCount ? `Signed out ${details.revokedCount} other session(s)` : `Signed out a session`;

    case AuditAction.EXPORTED:
      return `Exported ${details.projectCount} project(s)`;

    case AuditAction.SHARE_CREATED:
      return details.label ? `Created share link "${details.label}"` : `Created a share link`;

    case AuditAction.SHARE_REVOKED:
      return details.label ? `Revoked share link "${details.label}"` : `Revoked a share link`;

    case AuditAction.SHARE_OPENED:
      return `Share link was opened`;
  }

  return `${action} ${resourceType}`;
}
