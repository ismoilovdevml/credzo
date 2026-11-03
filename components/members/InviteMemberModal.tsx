"use client";

import { useRef, useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { notify } from "@/components/Toast";
import { api, errorMessage } from "@/lib/api-client";
import { ROLE_META, assignableRoles, memberName, roleLabel, type InviteResult, type OrgMember, type OrgRole, type PendingInvitation } from "./roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  actorRole: OrgRole;
  onMemberAdded: (member: OrgMember) => void;
  onInvitationCreated: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * Adds an existing user straight away, or records a pending invitation that is
 * claimed when someone signs up or signs in with that email.
 */
export function InviteMemberModal({
  open,
  onClose,
  organizationId,
  organizationName,
  actorRole,
  onMemberAdded,
  onInvitationCreated,
}: InviteMemberModalProps) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<PendingInvitation | null>(null);
  const roles = assignableRoles(actorRole);

  const reset = () => {
    setEmail("");
    setRole("member");
    setError(null);
    setInvitation(null);
  };

  const close = () => {
    if (submitting) return;
    onClose();
    reset();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<InviteResult>(`/api/organizations/${encodeURIComponent(organizationId)}/members`, {
        email: address,
        role,
      });
      if (result.type === "member") {
        onMemberAdded(result.member);
        notify.success(`${memberName(result.member)} joined ${organizationName} as ${ROLE_META[role].label.toLowerCase()}.`);
        onClose();
        reset();
      } else {
        setInvitation(result.invitation);
        onInvitationCreated();
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't send the invite. Please try again."));
      emailRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  if (invitation) {
    const inviteRole = roleLabel(invitation.role).toLowerCase();
    return (
      <Modal
        open={open}
        onClose={close}
        title="Invitation saved"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={reset}>
              Invite another
            </Button>
            <Button onClick={close}>Done</Button>
          </>
        }
      >
        <div className="flex items-start gap-3.5" role="status">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
            <MailCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-2 text-[14.5px] leading-relaxed text-ink-2">
            <p>
              <span className="break-all font-semibold text-ink">{invitation.email}</span> doesn&apos;t have a Credzo
              account yet.
            </p>
            <p>
              They&apos;ll join {organizationName} as {inviteRole} as soon as they sign up (or sign in) with this
              email before {dateFormat.format(new Date(invitation.expiresAt))}.
            </p>
            <p className="text-[13.5px] text-muted">No email is sent automatically, so let them know.</p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite a member"
      description={`Add someone to ${organizationName} by email.`}
      size="sm"
      initialFocusRef={emailRef}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="invite-member-form" loading={submitting} data-testid="invite-submit">
            Send invite
          </Button>
        </>
      }
    >
      <form id="invite-member-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email" required error={error}>
          <Input
            ref={emailRef}
            type="email"
            autoComplete="off"
            placeholder="name@company.com"
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            data-testid="invite-email-input"
          />
        </Field>
        <Field label="Role" hint={ROLE_META[role].summary}>
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as OrgRole)}
            data-testid="invite-role-select"
          >
            {roles.map((option) => (
              <option key={option} value={option}>
                {ROLE_META[option].label}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
