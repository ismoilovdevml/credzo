import type { BadgeTone } from "@/components/ui";

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export const ORG_ROLES: readonly OrgRole[] = ["owner", "admin", "member", "viewer"];

export interface OrgMemberUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** Row from GET /api/organizations/[id]/members. `user` is null when the account no longer exists. */
export interface OrgMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: OrgMemberUser | null;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

/** Row from GET /api/organizations/[id]/invitations. `invitedBy` is null when the inviter's account is gone. */
export interface InvitationListItem extends PendingInvitation {
  invitedBy: OrgMemberUser | null;
}

/** POST /api/organizations/[id]/members result. */
export type InviteResult =
  | { type: "member"; member: OrgMember }
  | { type: "invitation"; invitation: PendingInvitation };

export const ROLE_META: Record<OrgRole, { label: string; plural: string; tone: BadgeTone; summary: string }> = {
  owner: {
    label: "Owner",
    plural: "Owners",
    tone: "violet",
    summary:
      "Full control: organization settings, every member including other owners, and owner access to every organization project.",
  },
  admin: {
    label: "Admin",
    plural: "Admins",
    tone: "info",
    summary:
      "Manages settings, members (except owners) and the audit log; owner access to every organization project.",
  },
  member: {
    label: "Member",
    plural: "Members",
    tone: "accent",
    summary:
      "Creates projects and edits credentials in shared organization projects; private projects only when granted.",
  },
  viewer: {
    label: "Viewer",
    plural: "Viewers",
    tone: "neutral",
    summary: "Read-only: views, reveals and copies credentials in shared projects, never edits or deletes.",
  },
};

const ROLE_RANK: Record<OrgRole, number> = { owner: 0, admin: 1, member: 2, viewer: 3 };

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value);
}

export function roleRank(role: string): number {
  return isOrgRole(role) ? ROLE_RANK[role] : ORG_ROLES.length;
}

export function roleLabel(role: string): string {
  return isOrgRole(role) ? ROLE_META[role].label : role;
}

export function memberName(member: OrgMember): string {
  const user = member.user;
  if (!user) return "Deleted user";
  return `${user.firstName} ${user.lastName}`.trim() || user.username || user.email;
}

/** Owners and admins manage the member list. */
export function canManageMembers(actor: OrgRole | null): boolean {
  return actor === "owner" || actor === "admin";
}

/** Roles the actor may grant: only owners can grant ownership. */
export function assignableRoles(actor: OrgRole | null): OrgRole[] {
  if (actor === "owner") return [...ORG_ROLES];
  if (actor === "admin") return ["admin", "member", "viewer"];
  return [];
}

/** Admins cannot change or remove owners; members and viewers cannot touch anyone. */
export function canEditMember(actor: OrgRole | null, targetRole: string): boolean {
  if (actor === "owner") return true;
  return actor === "admin" && targetRole !== "owner";
}
