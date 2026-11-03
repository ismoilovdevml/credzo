import type { AuditLog } from "@/lib/types";
import type { CredentialView } from "@/lib/utils/credentials";
import type { ProjectSummary } from "@/lib/utils/projects";

export type DashboardCredential = CredentialView & { projectName: string };
export type { ProjectSummary };

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Credentials whose next rotation falls within this many days are listed as "due". */
export const DUE_SOON_DAYS = 14;

export const ENVIRONMENT_KEYS = ["production", "staging", "development", "unassigned"] as const;
export type EnvironmentKey = (typeof ENVIRONMENT_KEYS)[number];

export function credentialHref(credential: { id: string; projectId: string }): string {
  return `/dashboard/projects/${credential.projectId}/credentials/${credential.id}`;
}

/** "Good morning" / "Good afternoon" / "Good evening" for the viewer's local hour. */
export function greetingFor(time: number): string {
  const hour = new Date(time).getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "1 credential", "3 credentials". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

/** Compact relative time for activity feeds: "Just now", "4m", "3h", "Yesterday", "5d", "Mar 4". */
export function formatAgo(iso: string, now: number): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < 2 * DAY) return "Yesterday";
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`;
  const date = new Date(time);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}

/** "updated 12 min ago" style label used in the project list. */
export function formatUpdated(iso: string, now: number): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return "updated just now";
  if (elapsed < HOUR) return `updated ${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `updated ${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < 2 * DAY) return "updated yesterday";
  if (elapsed < 7 * DAY) return `updated ${Math.floor(elapsed / DAY)} days ago`;
  if (elapsed < 14 * DAY) return "updated last week";
  return `updated ${formatAgo(iso, now)}`;
}

export interface RotationItem {
  credential: DashboardCredential;
  /** Epoch ms when the credential is next due for rotation. */
  dueAt: number;
  overdue: boolean;
  /** Whole days until due, or since it fell due when overdue. */
  days: number;
}

/**
 * Rotation schedule of every credential with a rotation policy, soonest first.
 * Next due = (lastRotatedAt || createdAt) + rotationDays.
 */
export function rotationSchedule(credentials: DashboardCredential[], now: number): RotationItem[] {
  const items: RotationItem[] = [];
  for (const credential of credentials) {
    if (!credential.rotationDays || credential.rotationDays <= 0) continue;
    const base = Date.parse(credential.lastRotatedAt || credential.createdAt);
    if (Number.isNaN(base)) continue;
    const dueAt = base + credential.rotationDays * DAY;
    const overdue = dueAt < now;
    items.push({ credential, dueAt, overdue, days: Math.floor(Math.abs(dueAt - now) / DAY) });
  }
  return items.sort((a, b) => a.dueAt - b.dueAt);
}

/** Items overdue or due within DUE_SOON_DAYS. */
export function dueForRotation(schedule: RotationItem[]): RotationItem[] {
  return schedule.filter((item) => item.overdue || item.days < DUE_SOON_DAYS);
}

/** "12 days overdue", "Overdue", "Due today", "Due tomorrow", "Due in 3 days". */
export function rotationStatus({ overdue, days }: Pick<RotationItem, "overdue" | "days">): string {
  if (overdue) return days === 0 ? "Overdue" : `${pluralize(days, "day")} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${pluralize(days, "day")}`;
}

export function environmentTotals(credentials: DashboardCredential[]): Record<EnvironmentKey, number> {
  const totals: Record<EnvironmentKey, number> = { production: 0, staging: 0, development: 0, unassigned: 0 };
  for (const credential of credentials) totals[credential.environment ?? "unassigned"] += 1;
  return totals;
}

// ===== Audit activity =====

export interface OrganizationPerson {
  userId: string;
  user: { id: string; username: string; email: string; firstName: string; lastName: string } | null;
}

/** "Aziz Rahimov" -> "Aziz R."; falls back to the username or email. */
export function shortName(person: OrganizationPerson["user"]): string | null {
  if (!person) return null;
  const first = person.firstName.trim();
  const last = person.lastName.trim();
  if (first) return last ? `${first} ${last[0]}.` : first;
  return person.username || person.email || null;
}

export interface ActivityDescription {
  verb: string;
  /** Rendered in monospace (resource name, email…). */
  target?: string;
  /** Link for the target when the resource still exists. */
  href?: string;
  suffix?: string;
}

const text = (details: Record<string, unknown>, key: string): string => {
  const value = details[key];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
};

const CREDENTIAL_VERBS: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  accessed: "revealed",
  revealed: "revealed",
  copied: "copied",
};

const ACCOUNT_VERBS: Record<string, string> = {
  login: "signed in",
  logout: "signed out",
  password_changed: "changed their password",
  "2fa_enabled": "turned on two-factor authentication",
  "2fa_disabled": "turned off two-factor authentication",
  session_revoked: "signed out other sessions",
};

/** Human sentence (minus the actor) for an audit event. */
export function describeActivity(log: AuditLog, projectNames: Map<string, string>): ActivityDescription {
  const details = log.details ?? {};
  const projectId = text(details, "projectId");
  const projectName = projectId ? projectNames.get(projectId) : undefined;

  if (log.resourceType === "credential" && CREDENTIAL_VERBS[log.action]) {
    const name = text(details, "credentialName") || "a credential";
    const linkable = log.action !== "deleted" && projectId && log.resourceId && projectName;
    return {
      verb: CREDENTIAL_VERBS[log.action],
      target: name,
      href: linkable ? credentialHref({ id: log.resourceId as string, projectId }) : undefined,
      suffix: projectName ? `in ${projectName}` : undefined,
    };
  }

  if (log.resourceType === "project" && ["created", "updated", "deleted"].includes(log.action)) {
    const name = text(details, "projectName") || projectNames.get(log.resourceId ?? "") || "a project";
    const exists = log.action !== "deleted" && log.resourceId && projectNames.has(log.resourceId);
    return {
      verb: `${log.action} project`,
      target: name,
      href: exists ? `/dashboard/projects/${log.resourceId}` : undefined,
    };
  }

  switch (log.action) {
    case "invited":
      return { verb: "invited", target: text(details, "email"), suffix: `as ${text(details, "role") || "member"}` };
    case "removed":
      if (projectId) return { verb: "removed a member from", target: projectName ?? "a project" };
      return { verb: "removed", target: text(details, "removedUsername") || "a member", suffix: "from the organisation" };
    case "role_changed":
      return {
        verb: "changed the role of",
        target: text(details, "targetUsername") || "a member",
        suffix: `to ${text(details, "newRole")}`,
      };
    case "created":
      if (log.resourceType === "member") return { verb: "added a member to", target: projectName ?? "a project" };
      break;
    case "updated":
      if (log.resourceType === "organization") return { verb: "updated the organisation settings" };
      break;
    case "login_failed":
      return { verb: "failed to sign in as", target: text(details, "username") };
    case "exported": {
      const count = Number(details.projectCount);
      return { verb: "exported", suffix: Number.isFinite(count) ? pluralize(count, "project") : "projects" };
    }
    case "share_created":
    case "share_revoked": {
      const label = text(details, "label");
      const verb = log.action === "share_created" ? "created a share link" : "revoked a share link";
      return label ? { verb, target: label } : { verb };
    }
    case "share_opened":
      return { verb: "opened a share link" };
  }

  if (ACCOUNT_VERBS[log.action]) return { verb: ACCOUNT_VERBS[log.action] };
  return { verb: `${log.action.replace(/_/g, " ")} ${log.resourceType}`.trim() };
}
