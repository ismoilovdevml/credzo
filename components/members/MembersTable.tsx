"use client";

import { Trash2 } from "lucide-react";
import {
  Avatar,
  Badge,
  IconButton,
  Select,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import {
  ROLE_META,
  assignableRoles,
  canEditMember,
  isOrgRole,
  memberName,
  roleLabel,
  type OrgMember,
  type OrgRole,
} from "./roles";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

interface MembersTableProps {
  members: OrgMember[];
  currentUserId: string;
  actorRole: OrgRole | null;
  /** Owners in the whole organization (not just the filtered rows). */
  ownerCount: number;
  /** userId of the row with a role change in flight. */
  pendingUserId: string | null;
  onRoleChange: (member: OrgMember, role: OrgRole) => void;
  onRemove: (member: OrgMember) => void;
}

export function MembersTable({
  members,
  currentUserId,
  actorRole,
  ownerCount,
  pendingUserId,
  onRoleChange,
  onRemove,
}: MembersTableProps) {
  const roleOptions = assignableRoles(actorRole);
  const manageable = roleOptions.length > 0;

  return (
    <Table aria-label="Organization members" minWidthClass="min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          {manageable && (
            <TableHead className="w-16">
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody data-testid="members-list">
        {members.map((member) => {
          const name = memberName(member);
          const isSelf = member.userId === currentUserId;
          const isSoleOwner = member.role === "owner" && ownerCount <= 1;
          const editable = canEditMember(actorRole, member.role) && isOrgRole(member.role);
          const removable = editable && !isSelf && !isSoleOwner;
          const pending = pendingUserId === member.userId;
          const secondary = member.user
            ? member.user.email && member.user.email !== name
              ? member.user.email
              : `@${member.user.username}`
            : "Account no longer exists";

          return (
            <TableRow key={member.userId} data-testid="member-row" data-username={member.user?.username ?? ""}>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={name} size="md" />
                  <div className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-ink">{name}</span>
                      {isSelf && (
                        <Badge size="sm" tone="neutral">
                          You
                        </Badge>
                      )}
                    </span>
                    <span className="truncate text-[13px] text-muted">{secondary}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {editable ? (
                  <div className="flex items-center gap-2">
                    <div className="w-[136px]">
                      <Select
                        inputSize="sm"
                        value={member.role}
                        disabled={pending}
                        aria-label={`Role for ${name}`}
                        title={isSoleOwner ? "The last owner can't be demoted" : undefined}
                        onChange={(event) => onRoleChange(member, event.target.value as OrgRole)}
                        data-testid="member-role-select"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role} disabled={isSoleOwner && role !== "owner"}>
                            {ROLE_META[role].label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {pending && <Spinner className="h-4 w-4 text-muted" label="Updating role" />}
                  </div>
                ) : (
                  <Badge tone={isOrgRole(member.role) ? ROLE_META[member.role].tone : "neutral"}>
                    {roleLabel(member.role)}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-ink-2">{formatDate(member.joinedAt)}</TableCell>
              {manageable && (
                <TableCell className="py-2 text-right">
                  {removable && (
                    <IconButton
                      variant="danger"
                      label={`Remove ${name}`}
                      onClick={() => onRemove(member)}
                      disabled={pending}
                      data-testid="remove-member"
                    >
                      <Trash2 aria-hidden="true" />
                    </IconButton>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function MembersTableSkeleton() {
  return (
    <Table aria-label="Loading members" aria-busy="true" minWidthClass="min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-[34px] w-[34px] rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-6 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-3.5 w-24" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
