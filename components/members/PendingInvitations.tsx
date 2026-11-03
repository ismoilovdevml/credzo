"use client";

import { useCallback, useEffect, useState } from "react";
import { MailX } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { notify } from "@/components/Toast";
import { Badge, Button, Card, CardHeader, Skeleton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api-client";
import { ROLE_META, canEditMember, isOrgRole, roleLabel, type InvitationListItem, type OrgRole } from "./roles";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function inviterName(invitation: InvitationListItem): string {
  const user = invitation.invitedBy;
  if (!user) return "a former member";
  return `${user.firstName} ${user.lastName}`.trim() || user.username;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; invitations: InvitationListItem[] };

interface PendingInvitationsProps {
  organizationId: string;
  organizationName: string;
  actorRole: OrgRole;
  /** Changes whenever an invitation is created, to reload the list. */
  reloadKey: number;
}

/** Pending, unexpired invitations with a Revoke action (owners and admins). */
export function PendingInvitations({ organizationId, organizationName, actorRole, reloadKey }: PendingInvitationsProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // Kept after the dialog closes so its copy doesn't blank out during the exit animation.
  const [revoking, setRevoking] = useState<InvitationListItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<InvitationListItem[]>(`/api/organizations/${encodeURIComponent(organizationId)}/invitations`, {
        signal: controller.signal,
      })
      .then((invitations) => setState({ status: "ready", invitations }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: errorMessage(error, "Couldn't load pending invitations.") });
        }
      });
    return () => controller.abort();
  }, [organizationId, reloadKey, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  const revoke = async () => {
    if (!revoking) return;
    const target = revoking;
    try {
      await api.del(
        `/api/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(target.id)}`
      );
      setState((current) =>
        current.status === "ready"
          ? { status: "ready", invitations: current.invitations.filter((item) => item.id !== target.id) }
          : current
      );
      notify.success(`Invitation for ${target.email} revoked.`);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't revoke the invitation."));
    }
  };

  const count = state.status === "ready" ? state.invitations.length : 0;

  return (
    <Card data-testid="pending-invitations">
      <CardHeader
        title="Pending invitations"
        description="Invites for people without an account yet. They join when they sign up with the invited email."
        actions={
          count > 0 && (
            <Badge tone="accent" size="sm">
              {count}
            </Badge>
          )
        }
      />

      {state.status === "loading" && (
        <div className="flex flex-col gap-3 px-5 py-4" aria-busy="true" aria-label="Loading pending invitations">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p role="alert" className="text-[14px] text-danger">
            {state.message}
          </p>
          <Button variant="secondary" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {state.status === "ready" && count === 0 && (
        <p className="px-5 py-4 text-[14px] text-muted">No pending invitations.</p>
      )}

      {state.status === "ready" && count > 0 && (
        <ul className="divide-y divide-line-soft" data-testid="invitation-list">
          {state.invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
              data-testid="invitation-row"
              data-email={invitation.email}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-ink">{invitation.email}</span>
                  <Badge size="sm" tone={isOrgRole(invitation.role) ? ROLE_META[invitation.role].tone : "neutral"}>
                    {roleLabel(invitation.role)}
                  </Badge>
                </span>
                <span className="text-[13px] text-muted">
                  Invited by {inviterName(invitation)} · Expires{" "}
                  <time dateTime={invitation.expiresAt}>{dateFormat.format(new Date(invitation.expiresAt))}</time>
                </span>
              </div>
              {canEditMember(actorRole, invitation.role) && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<MailX />}
                  className="text-danger hover:bg-danger-soft hover:text-danger"
                  onClick={() => {
                    setRevoking(invitation);
                    setConfirmOpen(true);
                  }}
                  aria-label={`Revoke invitation for ${invitation.email}`}
                  data-testid="revoke-invitation"
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={revoke}
        variant="danger"
        title="Revoke invitation?"
        message={
          revoking ? `${revoking.email} won't be able to join ${organizationName} with this invitation.` : ""
        }
        details={["You can invite them again later."]}
        confirmText="Revoke invitation"
      />
    </Card>
  );
}
