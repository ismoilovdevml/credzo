"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search, ShieldOff, UserPlus, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSession } from "@/components/shell/SessionProvider";
import { notify } from "@/components/Toast";
import { Button, EmptyState, Input, PageHeader, SegmentedControl, Skeleton } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { InviteMemberModal } from "./InviteMemberModal";
import { PendingInvitations } from "./PendingInvitations";
import { MembersTable, MembersTableSkeleton } from "./MembersTable";
import { RolesPanel } from "./RolesPanel";
import {
  ORG_ROLES,
  ROLE_META,
  canManageMembers,
  isOrgRole,
  memberName,
  roleRank,
  type OrgMember,
  type OrgRole,
} from "./roles";

type RoleFilter = "all" | OrgRole;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; forbidden: boolean }
  | { status: "ready"; members: OrgMember[] };

/** Role change that lowers the caller's own access and needs confirming first. */
interface SelfDemotion {
  member: OrgMember;
  role: OrgRole;
}

function sortMembers(members: OrgMember[]): OrgMember[] {
  return [...members].sort(
    (a, b) => roleRank(a.role) - roleRank(b.role) || memberName(a).localeCompare(memberName(b))
  );
}

function matchesQuery(member: OrgMember, query: string): boolean {
  if (!query) return true;
  const haystack = [memberName(member), member.user?.username, member.user?.email].join(" ").toLowerCase();
  return haystack.includes(query);
}

export function MembersScreen() {
  const session = useSession();
  const { user, organization, isPlatformAdmin, refresh: refreshSession } = session;
  const organizationId = organization?.id ?? null;
  // Platform admins act as owners in every organization (lib/authorization.ts).
  const actorRole: OrgRole | null = isPlatformAdmin ? "owner" : isOrgRole(session.role) ? session.role : null;
  const canManage = canManageMembers(actorRole);

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitationsKey, setInvitationsKey] = useState(0);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  // Targets stay set after their dialog closes so the copy doesn't blank out during the exit animation.
  const [removing, setRemoving] = useState<OrgMember | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selfDemotion, setSelfDemotion] = useState<SelfDemotion | null>(null);
  const [demotionOpen, setDemotionOpen] = useState(false);

  const load = useCallback(async (orgId: string, signal?: { cancelled: boolean }) => {
    setState({ status: "loading" });
    try {
      const members = await api.get<OrgMember[]>(`/api/organizations/${encodeURIComponent(orgId)}/members`);
      if (!signal?.cancelled) setState({ status: "ready", members: sortMembers(members) });
    } catch (err) {
      if (signal?.cancelled) return;
      const forbidden = err instanceof ApiError && (err.status === 403 || err.status === 404);
      setState({ status: "error", message: errorMessage(err, "Couldn't load members."), forbidden });
    }
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    const signal = { cancelled: false };
    void load(organizationId, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [organizationId, load]);

  const members = useMemo(() => (state.status === "ready" ? state.members : []), [state]);

  const counts = useMemo(() => {
    const result: Record<RoleFilter, number> = { all: members.length, owner: 0, admin: 0, member: 0, viewer: 0 };
    for (const member of members) if (isOrgRole(member.role)) result[member.role] += 1;
    return result;
  }, [members]);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      members.filter(
        (member) => (filter === "all" || member.role === filter) && matchesQuery(member, normalizedQuery)
      ),
    [members, filter, normalizedQuery]
  );

  const replaceMember = (updated: OrgMember) =>
    setState((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            members: sortMembers(current.members.map((m) => (m.userId === updated.userId ? updated : m))),
          }
        : current
    );

  const applyRoleChange = async (member: OrgMember, role: OrgRole) => {
    if (!organizationId) return;
    setPendingUserId(member.userId);
    try {
      const updated = await api.put<OrgMember>(
        `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(member.userId)}`,
        { role }
      );
      replaceMember(updated);
      notify.success(`${memberName(member)} is now ${ROLE_META[role].label.toLowerCase()}.`);
      if (member.userId === user?.id) await refreshSession();
    } catch (err) {
      notify.error(errorMessage(err, "Couldn't change the role."));
    } finally {
      setPendingUserId(null);
    }
  };

  const requestRoleChange = (member: OrgMember, role: OrgRole) => {
    if (role === member.role) return;
    const isSelf = member.userId === user?.id;
    if (isSelf && !isPlatformAdmin && roleRank(role) > roleRank(member.role)) {
      setSelfDemotion({ member, role });
      setDemotionOpen(true);
      return;
    }
    void applyRoleChange(member, role);
  };

  const removeMember = async () => {
    if (!organizationId || !removing) return;
    const target = removing;
    try {
      await api.del<{ userId: string }>(
        `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(target.userId)}`
      );
      setState((current) =>
        current.status === "ready"
          ? { status: "ready", members: current.members.filter((m) => m.userId !== target.userId) }
          : current
      );
      notify.success(`${memberName(target)} was removed from ${organization?.name ?? "the organization"}.`);
    } catch (err) {
      notify.error(errorMessage(err, "Couldn't remove the member."));
    }
  };

  const addMember = (member: OrgMember) =>
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", members: sortMembers([...current.members.filter((m) => m.userId !== member.userId), member]) }
        : current
    );

  if (session.loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <MembersTableSkeleton />
      </div>
    );
  }

  if (!organization || !user) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Members" />
        <EmptyState
          icon={<ShieldOff />}
          title="No organization selected"
          description="Members belong to an organization. Join or switch to an organization to see who has access."
          action={
            <Button asChild variant="secondary">
              <Link href="/dashboard">Back to overview</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const description =
    state.status === "ready"
      ? `${members.length} ${members.length === 1 ? "person" : "people"} in ${organization.name}`
      : `People in ${organization.name}`;

  const filterOptions = [
    { value: "all" as const, label: "All", count: counts.all },
    ...ORG_ROLES.map((role) => ({ value: role, label: ROLE_META[role].plural, count: counts[role] })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        description={description}
        actions={
          canManage && (
            <Button
              leftIcon={<UserPlus />}
              onClick={() => setInviteOpen(true)}
              disabled={state.status !== "ready"}
              data-testid="invite-member-button"
            >
              Invite member
            </Button>
          )
        }
      />

      {!canManage && state.status === "ready" && (
        <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[14px] text-ink-2">
          You can see who belongs to {organization.name}. Only owners and admins can invite people or change roles.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<RoleFilter>
          aria-label="Filter by role"
          value={filter}
          onChange={setFilter}
          options={filterOptions}
        />
        <div className="hidden flex-1 sm:block" />
        <div className="w-full sm:w-[260px]">
          <Input
            type="search"
            aria-label="Search members"
            placeholder="Search people"
            leading={<Search />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="members-search"
          />
        </div>
      </div>

      {state.status === "loading" && <MembersTableSkeleton />}

      {state.status === "error" && (
        <EmptyState
          icon={state.forbidden ? <ShieldOff /> : <AlertTriangle />}
          title={state.forbidden ? "You don't have access to these members" : "Couldn't load members"}
          description={state.message}
          action={
            !state.forbidden && (
              <Button variant="secondary" onClick={() => void load(organization.id)}>
                Try again
              </Button>
            )
          }
        />
      )}

      {state.status === "ready" &&
        (visible.length > 0 ? (
          <MembersTable
            members={visible}
            currentUserId={user.id}
            actorRole={actorRole}
            ownerCount={counts.owner}
            pendingUserId={pendingUserId}
            onRoleChange={requestRoleChange}
            onRemove={(member) => {
              setRemoving(member);
              setRemoveOpen(true);
            }}
          />
        ) : (
          <EmptyState
            icon={<Users />}
            title={members.length === 0 ? "No members yet" : "No matching members"}
            description={
              members.length === 0
                ? "Invite people by email to share projects with them."
                : "Try a different name or email, or clear the role filter."
            }
            action={
              members.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ))}

      {canManage && actorRole && (
        <PendingInvitations
          organizationId={organization.id}
          organizationName={organization.name}
          actorRole={actorRole}
          reloadKey={invitationsKey}
        />
      )}

      <RolesPanel />

      {canManage && actorRole && (
        <InviteMemberModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          organizationId={organization.id}
          organizationName={organization.name}
          actorRole={actorRole}
          onMemberAdded={addMember}
          onInvitationCreated={() => setInvitationsKey((key) => key + 1)}
        />
      )}

      <ConfirmDialog
        isOpen={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={removeMember}
        variant="danger"
        title="Remove member?"
        message={
          removing
            ? `${memberName(removing)} will lose access to ${organization.name} and all of its projects.`
            : ""
        }
        details={["Their project grants inside this organization are revoked too.", "You can invite them again later."]}
        confirmText="Remove member"
      />

      <ConfirmDialog
        isOpen={demotionOpen}
        onClose={() => setDemotionOpen(false)}
        onConfirm={async () => {
          if (selfDemotion) await applyRoleChange(selfDemotion.member, selfDemotion.role);
        }}
        variant="warning"
        title="Change your own role?"
        message={
          selfDemotion
            ? `You'll become ${ROLE_META[selfDemotion.role].label.toLowerCase()} in ${organization.name}. ${
                selfDemotion.role === "admin"
                  ? "Only an owner can make you an owner again."
                  : "You won't be able to manage members afterwards, and only an owner or admin can change it back."
              }`
            : ""
        }
        confirmText="Change role"
      />
    </div>
  );
}
