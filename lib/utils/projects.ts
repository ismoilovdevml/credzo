/**
 * Project read models shared by the project API routes.
 */

import type { ProjectRef, ProjectRole } from '@/lib/authorization';
import { getDb } from '@/lib/db';
import { CREDENTIAL_ENVIRONMENTS } from '@/lib/types';
import type { CredentialEnvironment } from '@/lib/types';

export type EnvironmentBreakdown = Record<CredentialEnvironment | 'unassigned', number>;

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  organizationId: string | null;
  ownerId: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  currentUserRole: ProjectRole;
  credentialCount: number;
  /** Explicit project member grants (the owner and inherited organization access are not counted). */
  memberCount: number;
  environments: EnvironmentBreakdown;
}

export interface UserSummary {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface ProjectMemberView {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  addedAt: string;
  user: UserSummary;
}

interface ProjectStats {
  credentialCount: number;
  memberCount: number;
  environments: EnvironmentBreakdown;
}

function emptyStats(): ProjectStats {
  return {
    credentialCount: 0,
    memberCount: 0,
    environments: { production: 0, staging: 0, development: 0, unassigned: 0 },
  };
}

function isEnvironment(value: string | null): value is CredentialEnvironment {
  return value !== null && (CREDENTIAL_ENVIRONMENTS as readonly string[]).includes(value);
}

/** Credential/member counts for the given projects, computed with two grouped queries. */
function loadProjectStats(projectIds: string[]): Map<string, ProjectStats> {
  const stats = new Map(projectIds.map((id) => [id, emptyStats()]));
  if (projectIds.length === 0) return stats;

  const database = getDb();
  const credentialRows = database
    .prepare('SELECT project_id, environment, COUNT(*) AS count FROM credentials GROUP BY project_id, environment')
    .all() as { project_id: string; environment: string | null; count: number }[];
  const memberRows = database
    .prepare('SELECT project_id, COUNT(*) AS count FROM project_members GROUP BY project_id')
    .all() as { project_id: string; count: number }[];

  for (const row of credentialRows) {
    const entry = stats.get(row.project_id);
    if (!entry) continue;
    entry.credentialCount += row.count;
    entry.environments[isEnvironment(row.environment) ? row.environment : 'unassigned'] += row.count;
  }
  for (const row of memberRows) {
    const entry = stats.get(row.project_id);
    if (entry) entry.memberCount = row.count;
  }
  return stats;
}

export function buildProjectSummaries(
  projects: { project: ProjectRef; role: ProjectRole }[]
): ProjectSummary[] {
  const stats = loadProjectStats(projects.map(({ project }) => project.id));
  return projects.map(({ project, role }) => ({
    ...project,
    currentUserRole: role,
    ...(stats.get(project.id) ?? emptyStats()),
  }));
}

interface MemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  added_at: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

const MEMBER_SELECT = `
  SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.added_at,
         u.username, u.email, u.first_name, u.last_name
  FROM project_members pm
  JOIN users u ON u.id = pm.user_id`;

function toMemberView(row: MemberRow): ProjectMemberView {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role,
    addedAt: row.added_at,
    user: {
      id: row.user_id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
    },
  };
}

export function listProjectMembers(projectId: string): ProjectMemberView[] {
  const rows = getDb()
    .prepare(`${MEMBER_SELECT} WHERE pm.project_id = ? ORDER BY pm.added_at DESC`)
    .all(projectId) as MemberRow[];
  return rows.map(toMemberView);
}

export function getProjectMember(projectId: string, memberId: string): ProjectMemberView | null {
  const row = getDb()
    .prepare(`${MEMBER_SELECT} WHERE pm.project_id = ? AND pm.id = ?`)
    .get(projectId, memberId) as MemberRow | undefined;
  return row ? toMemberView(row) : null;
}

export function getUserSummary(userId: string): UserSummary | null {
  const row = getDb()
    .prepare('SELECT id, username, email, first_name, last_name FROM users WHERE id = ?')
    .get(userId) as
    | { id: string; username: string; email: string; first_name: string; last_name: string }
    | undefined;
  return row
    ? { id: row.id, username: row.username, email: row.email, firstName: row.first_name, lastName: row.last_name }
    : null;
}
