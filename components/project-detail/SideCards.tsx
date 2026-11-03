"use client";

import { useMemo } from "react";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import { roleLabel, roleTone, rotationStatus, userName, type CredentialView, type ProjectDetail } from "./model";

const TEAM_PREVIEW = 4;

/** Owner plus the first explicit members, with a link to the Members tab. */
export function TeamCard({ project, onManage }: { project: ProjectDetail; onManage: () => void }) {
  const people = [
    ...(project.owner ? [{ id: project.owner.id, name: userName(project.owner), role: "owner" }] : []),
    ...project.members.map((member) => ({ id: member.id, name: userName(member.user), role: member.role })),
  ];
  const hidden = people.length - TEAM_PREVIEW;

  return (
    <Card padded className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15.5px] font-bold text-ink">Team</h2>
        <Button variant="link" size="sm" onClick={onManage}>
          {project.currentUserRole === "owner" ? "Manage" : "View all"}
        </Button>
      </div>
      <ul className="flex flex-col gap-3">
        {people.slice(0, TEAM_PREVIEW).map((person) => (
          <li key={person.id} className="flex items-center gap-2.5">
            <Avatar name={person.name} size="sm" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{person.name}</span>
            <Badge tone={roleTone(person.role)} size="sm">
              {roleLabel(person.role)}
            </Badge>
          </li>
        ))}
      </ul>
      {hidden > 0 && <span className="text-[13px] text-muted">+{hidden} more</span>}
      {project.organizationId && (
        <p className="text-[12.5px] leading-relaxed text-muted">
          Organization members also have access based on their organization role.
        </p>
      )}
    </Card>
  );
}

const HEALTH_ROWS = [
  { state: "ok", label: "Up to date", text: "text-ink-2", bar: "bg-accent" },
  { state: "soon", label: "Rotate soon", text: "text-warn", bar: "bg-warn" },
  { state: "overdue", label: "Overdue", text: "text-danger", bar: "bg-danger" },
] as const;

/** Rotation health of credentials that have a rotation policy. */
export function HealthCard({ credentials, now }: { credentials: CredentialView[]; now: number }) {
  const counts = useMemo(() => {
    const result = { none: 0, ok: 0, soon: 0, overdue: 0 };
    for (const credential of credentials) result[rotationStatus(credential, now).state] += 1;
    return result;
  }, [credentials, now]);
  const tracked = counts.ok + counts.soon + counts.overdue;

  return (
    <Card padded className="flex flex-col gap-3">
      <h2 className="text-[15.5px] font-bold text-ink">Project health</h2>
      {tracked === 0 ? (
        <p className="text-[13.5px] leading-relaxed text-muted">
          No credential has a rotation interval yet. Set one on a credential to track when it is due.
        </p>
      ) : (
        <>
          <dl className="flex flex-col gap-2.5">
            {HEALTH_ROWS.map((row) => (
              <div key={row.state} className="flex justify-between gap-3 text-[14px]">
                <dt className={row.text}>{row.label}</dt>
                <dd className="font-bold text-ink">{counts[row.state]}</dd>
              </div>
            ))}
          </dl>
          <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded">
            {HEALTH_ROWS.map(
              (row) =>
                counts[row.state] > 0 && (
                  <span key={row.state} className={row.bar} style={{ flexGrow: counts[row.state] }} />
                )
            )}
          </div>
          {counts.none > 0 && (
            <p className="text-[12.5px] text-muted">
              {counts.none} {counts.none === 1 ? "credential has" : "credentials have"} no rotation policy.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
