import { getDb, getOrganizationById } from "./db";
import type { AuthContext, Organization } from "./types";
import { OrganizationRole, UserRole } from "./types";
import { AuthorizationError, ConflictError, NotFoundError } from "./utils/errors";

/**
 * Role-based access control for organizations, projects and credentials.
 *
 * Organization roles:
 *   owner, admin  manage the organization, its members and every project in it
 *   member        edits shared (non-private) organization projects
 *   viewer        read-only everywhere in the organization
 *
 * Project roles (effective, per user):
 *   owner   edit credentials, manage project members, delete the project
 *   editor  create, edit and delete credentials and services
 *   viewer  read (and reveal) credentials only
 *
 * Organization projects are only reachable by current organization members, so
 * removing someone from an organization revokes every project grant inside it.
 * Platform admins are treated as owners of everything.
 */

export const PROJECT_ROLES = ["owner", "editor", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const ORGANIZATION_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.MEMBER,
  OrganizationRole.VIEWER,
] as const;

export type ProjectAccessLevel = "read" | "edit" | "manage";

const PROJECT_ROLE_RANK: Record<ProjectRole, number> = { viewer: 1, editor: 2, owner: 3 };
const REQUIRED_RANK: Record<ProjectAccessLevel, number> = { read: 1, edit: 2, manage: 3 };

/** Project row without its credentials, used for access decisions and listings. */
export interface ProjectRef {
  id: string;
  name: string;
  description: string;
  organizationId: string | null;
  ownerId: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  owner_id: string;
  visibility: string | null;
  created_at: string;
  updated_at: string;
}

const PROJECT_COLUMNS =
  "id, name, description, organization_id, owner_id, visibility, created_at, updated_at";

/** The caller's memberships, loaded once per request. */
export interface AccessScope {
  userId: string;
  isPlatformAdmin: boolean;
  organizationRoles: Map<string, string>;
  projectGrants: Map<string, ProjectRole>;
}

export function isPlatformAdmin(context: AuthContext): boolean {
  return context.user.role === UserRole.PLATFORM_ADMIN;
}

function isProjectRole(value: unknown): value is ProjectRole {
  return typeof value === "string" && (PROJECT_ROLES as readonly string[]).includes(value);
}

function toProjectRef(row: ProjectRow): ProjectRef {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    organizationId: row.organization_id,
    ownerId: row.owner_id,
    visibility: row.visibility ?? "private",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function loadAccessScope(context: AuthContext): AccessScope {
  const database = getDb();
  const userId = context.user.id;

  const organizationRows = database
    .prepare("SELECT organization_id, role FROM organization_members WHERE user_id = ?")
    .all(userId) as { organization_id: string; role: string }[];

  const grantRows = database
    .prepare("SELECT project_id, role FROM project_members WHERE user_id = ?")
    .all(userId) as { project_id: string; role: string }[];

  const projectGrants = new Map<string, ProjectRole>();
  for (const row of grantRows) {
    if (isProjectRole(row.role)) projectGrants.set(row.project_id, row.role);
  }

  return {
    userId,
    isPlatformAdmin: isPlatformAdmin(context),
    organizationRoles: new Map(organizationRows.map((row) => [row.organization_id, row.role])),
    projectGrants,
  };
}

function strongerRole(a: ProjectRole | null, b: ProjectRole | null): ProjectRole | null {
  if (!a) return b;
  if (!b) return a;
  return PROJECT_ROLE_RANK[a] >= PROJECT_ROLE_RANK[b] ? a : b;
}

/** Effective project role for the caller, or null when the project is not visible to them. */
export function getProjectRole(scope: AccessScope, project: ProjectRef): ProjectRole | null {
  if (scope.isPlatformAdmin) return "owner";

  const grant = scope.projectGrants.get(project.id) ?? null;

  if (!project.organizationId) {
    return project.ownerId === scope.userId ? "owner" : grant;
  }

  const organizationRole = scope.organizationRoles.get(project.organizationId);
  if (!organizationRole) return null;

  if (organizationRole === OrganizationRole.OWNER || organizationRole === OrganizationRole.ADMIN) {
    return "owner";
  }

  const isViewer = organizationRole === OrganizationRole.VIEWER;
  if (project.ownerId === scope.userId) return isViewer ? "viewer" : "owner";

  const inherited: ProjectRole | null =
    project.visibility === "private" ? null : isViewer ? "viewer" : "editor";
  const role = strongerRole(grant, inherited);

  return role && isViewer ? "viewer" : role;
}

export function hasProjectAccess(role: ProjectRole | null, level: ProjectAccessLevel): boolean {
  return role !== null && PROJECT_ROLE_RANK[role] >= REQUIRED_RANK[level];
}

export function getProjectRef(projectId: string): ProjectRef | null {
  const row = getDb()
    .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`)
    .get(projectId) as ProjectRow | undefined;
  return row ? toProjectRef(row) : null;
}

/** Every project the caller can read, with their effective role. */
export function listAccessibleProjects(
  scope: AccessScope
): { project: ProjectRef; role: ProjectRole }[] {
  const rows = getDb()
    .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY updated_at DESC`)
    .all() as ProjectRow[];

  const accessible: { project: ProjectRef; role: ProjectRole }[] = [];
  for (const row of rows) {
    const project = toProjectRef(row);
    const role = getProjectRole(scope, project);
    if (role) accessible.push({ project, role });
  }
  return accessible;
}

const ACCESS_DENIED_MESSAGES: Record<ProjectAccessLevel, string> = {
  read: "You do not have access to this project",
  edit: "You have read-only access to this project",
  manage: "Only project owners can perform this action",
};

/**
 * Resolve a project and assert the caller's access level.
 * Projects the caller cannot see at all are reported as 404 so IDs cannot be probed.
 */
export function requireProjectAccess(
  context: AuthContext,
  projectId: string,
  level: ProjectAccessLevel
): { project: ProjectRef; role: ProjectRole; scope: AccessScope } {
  const project = getProjectRef(projectId);
  const scope = loadAccessScope(context);
  const role = project ? getProjectRole(scope, project) : null;

  if (!project || !role) throw new NotFoundError("Project");
  if (!hasProjectAccess(role, level)) throw new AuthorizationError(ACCESS_DENIED_MESSAGES[level]);

  return { project, role, scope };
}

/** Resolve the project that owns a credential and assert the caller's access level. */
export function requireCredentialAccess(
  context: AuthContext,
  credentialId: string,
  level: ProjectAccessLevel
): { project: ProjectRef; role: ProjectRole } {
  const row = getDb()
    .prepare("SELECT project_id FROM credentials WHERE id = ?")
    .get(credentialId) as { project_id: string } | undefined;
  if (!row) throw new NotFoundError("Credential");

  const project = getProjectRef(row.project_id);
  const role = project ? getProjectRole(loadAccessScope(context), project) : null;

  if (!project || !role) throw new NotFoundError("Credential");
  if (!hasProjectAccess(role, level)) throw new AuthorizationError(ACCESS_DENIED_MESSAGES[level]);

  return { project, role };
}

// ===== Organizations =====

function isOrganizationManager(role: string | null): boolean {
  return role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN;
}

/** The caller's role in an organization; platform admins act as owners. */
export function getOrganizationRole(context: AuthContext, organizationId: string): string | null {
  if (isPlatformAdmin(context)) return OrganizationRole.OWNER;
  const row = getDb()
    .prepare("SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?")
    .get(organizationId, context.user.id) as { role: string } | undefined;
  return row?.role ?? null;
}

/**
 * Resolve an organization and assert the caller may read it (any member)
 * or manage it (owner/admin). Non-members get 404.
 */
export function requireOrganizationAccess(
  context: AuthContext,
  organizationId: string,
  level: "read" | "manage"
): { organization: Organization; role: string } {
  const organization = getOrganizationById(organizationId);
  const role = organization ? getOrganizationRole(context, organizationId) : null;

  if (!organization || !role) throw new NotFoundError("Organization");
  if (level === "manage" && !isOrganizationManager(role)) {
    throw new AuthorizationError("Only organization owners and admins can perform this action");
  }

  return { organization, role };
}

/** Organization roles that may create projects inside the organization. */
export function canCreateOrganizationProjects(role: string | null): boolean {
  return (
    role === OrganizationRole.OWNER ||
    role === OrganizationRole.ADMIN ||
    role === OrganizationRole.MEMBER
  );
}

/**
 * Organization new projects land in when none is specified: the caller's
 * current organization if they may create projects there, otherwise personal.
 */
export function getDefaultProjectOrganizationId(context: AuthContext): string | undefined {
  const organizationId = context.organization?.id;
  if (!organizationId) return undefined;
  return canCreateOrganizationProjects(getOrganizationRole(context, organizationId))
    ? organizationId
    : undefined;
}

function countOrganizationOwners(organizationId: string): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS count FROM organization_members WHERE organization_id = ? AND role = ?"
    )
    .get(organizationId, OrganizationRole.OWNER) as { count: number };
  return row.count;
}

/**
 * Assert that an owner/admin may change a member's role.
 * Only owners may touch owners or grant ownership, and the last owner cannot be demoted.
 */
export function assertCanChangeMemberRole(
  organizationId: string,
  actorRole: string,
  targetRole: string,
  newRole: string
): void {
  const touchesOwnership = targetRole === OrganizationRole.OWNER || newRole === OrganizationRole.OWNER;
  if (touchesOwnership && actorRole !== OrganizationRole.OWNER) {
    throw new AuthorizationError("Only organization owners can change ownership");
  }
  if (
    targetRole === OrganizationRole.OWNER &&
    newRole !== OrganizationRole.OWNER &&
    countOrganizationOwners(organizationId) <= 1
  ) {
    throw new ConflictError("An organization must keep at least one owner");
  }
}

/** Assert that an owner/admin may remove a member. Admins cannot remove owners. */
export function assertCanRemoveMember(
  organizationId: string,
  actorRole: string,
  targetRole: string
): void {
  if (targetRole !== OrganizationRole.OWNER) return;
  if (actorRole !== OrganizationRole.OWNER) {
    throw new AuthorizationError("Only organization owners can remove an owner");
  }
  if (countOrganizationOwners(organizationId) <= 1) {
    throw new ConflictError("An organization must keep at least one owner");
  }
}

/** Assert that the caller may grant `role` when inviting someone. */
export function assertCanGrantOrganizationRole(actorRole: string, role: string): void {
  if (role === OrganizationRole.OWNER && actorRole !== OrganizationRole.OWNER) {
    throw new AuthorizationError("Only organization owners can grant the owner role");
  }
}
