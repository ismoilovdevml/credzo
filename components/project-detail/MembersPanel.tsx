"use client";

import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { notify } from "@/components/Toast";
import { Avatar, Badge, Button, Card, CardHeader, IconButton, Select } from "@/components/ui";
import { apiRequest, errorMessage } from "./api";
import {
  PROJECT_ROLE_OPTIONS,
  canManageProject,
  roleLabel,
  roleTone,
  userName,
  type ProjectDetail,
  type ProjectMemberView,
  type ProjectRole,
  type UserSummary,
} from "./model";

interface MembersPanelProps {
  project: ProjectDetail;
  onAddMember: () => void;
  onMemberChanged: (member: ProjectMemberView) => void;
  onMemberRemoved: (memberId: string) => void;
}

function Person({ user }: { user: UserSummary }) {
  const name = userName(user);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar name={name} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[14.5px] font-semibold text-ink">{name}</span>
        <span className="truncate text-[13px] text-muted">{user.email}</span>
      </div>
    </div>
  );
}

export function MembersPanel({ project, onAddMember, onMemberChanged, onMemberRemoved }: MembersPanelProps) {
  const canManage = canManageProject(project.currentUserRole);
  const isOrgProject = project.organizationId !== null;
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<ProjectMemberView | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const memberUrl = (memberId: string) =>
    `/api/projects/${encodeURIComponent(project.id)}/members/${encodeURIComponent(memberId)}`;

  const changeRole = async (member: ProjectMemberView, role: ProjectRole) => {
    setUpdatingId(member.id);
    try {
      const updated = await apiRequest<ProjectMemberView>(memberUrl(member.id), { method: "PATCH", body: { role } });
      onMemberChanged(updated);
      notify.success(`${userName(member.user)} is now ${roleLabel(role).toLowerCase()}`);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't change the role"));
    } finally {
      setUpdatingId(null);
    }
  };

  const removeMember = async () => {
    if (!pendingRemoval) return;
    try {
      await apiRequest(memberUrl(pendingRemoval.id), { method: "DELETE" });
      onMemberRemoved(pendingRemoval.id);
      notify.success(`${userName(pendingRemoval.user)} removed from the project`);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't remove the member"));
    }
  };

  return (
    <Card data-testid="project-members">
      <CardHeader
        title="Project members"
        description={
          isOrgProject
            ? "People with explicit access. Organization members also get access through their organization role."
            : "People you have shared this personal project with."
        }
        actions={
          canManage &&
          isOrgProject && (
            <Button size="sm" leftIcon={<UserPlus />} onClick={onAddMember}>
              Add member
            </Button>
          )
        }
      />
      <ul className="divide-y divide-line-soft">
        {project.owner && (
          <li className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <Person user={project.owner} />
            <Badge tone={roleTone("owner")}>Project owner</Badge>
          </li>
        )}
        {project.members.map((member) => (
          <li
            key={member.id}
            data-testid="project-member-row"
            data-member-id={member.id}
            className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          >
            <Person user={member.user} />
            {canManage ? (
              <div className="flex items-center gap-1.5">
                <Select
                  inputSize="sm"
                  value={member.role}
                  onChange={(event) => changeRole(member, event.target.value as ProjectRole)}
                  disabled={updatingId === member.id}
                  aria-label={`Project role for ${userName(member.user)}`}
                  className="w-[124px]"
                >
                  {PROJECT_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <IconButton
                  label={`Remove ${userName(member.user)}`}
                  variant="danger"
                  onClick={() => {
                    setPendingRemoval(member);
                    setConfirmOpen(true);
                  }}
                >
                  <UserMinus />
                </IconButton>
              </div>
            ) : (
              <Badge tone={roleTone(member.role)}>{roleLabel(member.role)}</Badge>
            )}
          </li>
        ))}
      </ul>
      {project.members.length === 0 && (
        <p className="border-t border-line-soft px-5 py-4 text-[14px] text-muted">
          {isOrgProject
            ? "No one has an explicit grant yet."
            : "No one else has access to this personal project."}
        </p>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={removeMember}
        title="Remove member?"
        message={`${pendingRemoval ? userName(pendingRemoval.user) : "This person"} will lose their explicit access to this project.${
          isOrgProject ? " Access through their organization role is not affected." : ""
        }`}
        confirmText="Remove"
        variant="danger"
      />
    </Card>
  );
}
