"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { notify } from "@/components/Toast";
import { Button, Field, Modal, Select, Skeleton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api-client";
import {
  PROJECT_ROLE_OPTIONS,
  userName,
  type OrganizationMemberView,
  type ProjectDetail,
  type ProjectMemberView,
  type ProjectRole,
} from "./model";

const FORM_ID = "add-project-member-form";

interface AddMemberModalProps {
  open: boolean;
  project: ProjectDetail;
  onClose: () => void;
  onAdded: (member: ProjectMemberView) => void;
}

type Candidates =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; members: OrganizationMemberView[] };

/** Grants a member of the project's organization explicit access. Mount with a fresh `key` per opening. */
export function AddMemberModal({ open, project, onClose, onAdded }: AddMemberModalProps) {
  const organizationId = project.organizationId;
  const [candidates, setCandidates] = useState<Candidates>({ status: "loading" });
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ProjectRole>("viewer");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !organizationId) return;
    let cancelled = false;
    api.get<OrganizationMemberView[]>(`/api/organizations/${encodeURIComponent(organizationId)}/members`)
      .then((members) => {
        if (!cancelled) setCandidates({ status: "ready", members });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCandidates({ status: "error", message: errorMessage(error, "Couldn't load organization members") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  const available = useMemo(() => {
    if (candidates.status !== "ready") return [];
    const taken = new Set([project.ownerId, ...project.members.map((member) => member.userId)]);
    return candidates.members
      .filter((member): member is OrganizationMemberView & { user: NonNullable<OrganizationMemberView["user"]> } =>
        member.user !== null && !taken.has(member.userId)
      )
      .sort((a, b) => userName(a.user).localeCompare(userName(b.user)));
  }, [candidates, project.ownerId, project.members]);

  const selected = available.some((member) => member.userId === userId) ? userId : "";
  const selectedIsOrgViewer = available.find((member) => member.userId === selected)?.role === "viewer";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const member = await api.post<ProjectMemberView>(`/api/projects/${encodeURIComponent(project.id)}/members`, {
        userId: selected,
        role,
      });
      onAdded(member);
      notify.success(`${userName(member.user)} added to the project`);
      onClose();
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't add the member"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add project member"
      description="Give someone from your organization explicit access to this project."
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={!selected}>
            Add member
          </Button>
        </>
      }
    >
      {candidates.status === "loading" ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-[72px] w-full" />
          <Skeleton className="h-[72px] w-full" />
        </div>
      ) : candidates.status === "error" ? (
        <p role="alert" className="text-[14px] text-danger">
          {candidates.message}
        </p>
      ) : available.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-muted">
          Everyone in the organization already has an explicit grant on this project. Invite people to the
          organization first from the Members page.
        </p>
      ) : (
        <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Person" required>
            <Select value={selected} onChange={(event) => setUserId(event.target.value)}>
              <option value="" disabled>
                Choose a member…
              </option>
              {available.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {userName(member.user)} ({member.user.email})
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Project role"
            hint={
              selectedIsOrgViewer
                ? "Organization viewers stay read-only, whatever their project role."
                : "Viewers can read and reveal; editors manage credentials and services; owners also manage members."
            }
          >
            <Select value={role} onChange={(event) => setRole(event.target.value as ProjectRole)}>
              {PROJECT_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      )}
    </Modal>
  );
}
