import Link from "next/link";
import { Activity, AlertTriangle, KeyRound } from "lucide-react";
import { Avatar, Card, CardHeader } from "@/components/ui";
import type { AuditLog } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { credentialHref, describeActivity, formatAgo, type DashboardCredential } from "./insights";
import { RowsSkeleton, SectionLink, SectionMessage, rowLinkClass } from "./section";

const MAX_RECENT = 6;

export type AuditFeedState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; logs: AuditLog[]; people: Map<string, string> };

export interface AuditActivityProps {
  feed: AuditFeedState;
  now: number;
  currentUserId: string | null;
  projectNames: Map<string, string>;
}

/** Latest organisation audit events (owners and admins). */
export function AuditActivity({ feed, now, currentUserId, projectNames }: AuditActivityProps) {
  return (
    <Card className="overflow-hidden" data-testid="recent-activity">
      <CardHeader title="Recent activity" actions={<SectionLink href="/dashboard/audit">Full audit log</SectionLink>} />
      {feed.status === "loading" ? (
        <RowsSkeleton rows={5} avatar="h-[30px] w-[30px] rounded-full" />
      ) : feed.status === "error" ? (
        <SectionMessage icon={<AlertTriangle />} title="Couldn't load activity">
          {feed.message}
        </SectionMessage>
      ) : feed.logs.length === 0 ? (
        <SectionMessage icon={<Activity />} title="No activity yet">
          Reveals, edits and membership changes in this organisation show up here.
        </SectionMessage>
      ) : (
        <ul className="flex flex-col py-1.5">
          {feed.logs.map((log) => {
            const self = log.userId !== "" && log.userId === currentUserId;
            const actor = self ? "You" : (log.userId && feed.people.get(log.userId)) || "Someone";
            const avatarName = self ? (feed.people.get(log.userId) ?? actor) : actor;
            const { verb, target, href, suffix } = describeActivity(log, projectNames);
            return (
              <li
                key={log.id}
                data-testid="activity-item"
                className="flex items-center gap-3 px-5 py-2.5 text-[14px]"
              >
                <Avatar name={avatarName} size="sm" />
                <p className="min-w-0 flex-1 break-words leading-snug text-ink-2">
                  <strong className="font-semibold text-ink">{actor}</strong> {verb}
                  {target &&
                    (href ? (
                      <>
                        {" "}
                        <Link
                          href={href}
                          className="rounded font-mono text-[13px] text-ink underline-offset-2 hover:text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                        >
                          {target}
                        </Link>
                      </>
                    ) : (
                      <>
                        {" "}
                        <span className="font-mono text-[13px] text-ink">{target}</span>
                      </>
                    ))}
                  {suffix && ` ${suffix}`}
                </p>
                <time dateTime={log.timestamp} title={new Date(log.timestamp).toLocaleString()} className="flex-none text-[13px] text-muted">
                  {formatAgo(log.timestamp, now)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** For members without audit access: their most recently changed credentials. */
export function RecentlyUpdated({ credentials, now }: { credentials: DashboardCredential[] | null; now: number }) {
  const recent = credentials
    ? [...credentials].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, MAX_RECENT)
    : null;

  return (
    <Card className="overflow-hidden" data-testid="recent-activity">
      <CardHeader title="Recently updated" description="Credentials changed most recently across your projects" />
      {recent === null ? (
        <RowsSkeleton rows={4} avatar="h-8 w-8 rounded-lg" />
      ) : recent.length === 0 ? (
        <SectionMessage icon={<KeyRound />} title="No credentials yet">
          Credentials you add to a project show up here.
        </SectionMessage>
      ) : (
        <ul className="flex flex-col">
          {recent.map((credential) => (
            <li key={credential.id} className="border-b border-line-soft last:border-b-0">
              <Link
                href={credentialHref(credential)}
                data-testid="activity-item"
                className={cn("flex items-center gap-3 px-5 py-3", rowLinkClass)}
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent-soft text-accent-ink"
                >
                  <KeyRound className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-mono text-[13.5px] font-medium text-ink">{credential.name}</span>
                  <span className="truncate text-[13px] text-muted">{credential.projectName}</span>
                </span>
                <time dateTime={credential.updatedAt} className="flex-none text-[13px] text-muted">
                  {formatAgo(credential.updatedAt, now)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
