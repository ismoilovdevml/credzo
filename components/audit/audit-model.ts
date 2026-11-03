import type { BadgeTone } from "@/components/ui";
import { AuditAction, AuditResource } from "@/lib/types";

/** One audit log entry as returned by GET /api/organizations/[id]/audit. */
export interface AuditEvent {
  id: string;
  organizationId?: string;
  /** Empty string when the actor is unknown (failed sign-in) or has been deleted. */
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

/** Filters mirrored in the URL query string. Empty string = not set. */
export interface AuditFilters {
  search: string;
  action: string;
  resource: string;
  user: string;
  /** YYYY-MM-DD, local time, inclusive. */
  from: string;
  /** YYYY-MM-DD, local time, inclusive. */
  to: string;
}

export const FILTER_KEYS = [
  "search",
  "action",
  "resource",
  "user",
  "from",
  "to",
] as const satisfies readonly (keyof AuditFilters)[];

export interface Person {
  id: string;
  name: string;
}

interface ActionMeta {
  label: string;
  tone: BadgeTone;
  /** Sentence fragment after the actor's name. */
  verb: string;
  /** Append the resource noun ("credential", "project"…) after the verb. */
  withNoun?: boolean;
  /** The resource name is not meaningful for this action (it is the actor). */
  noTarget?: boolean;
  /** Render "Actor’s …" instead of "Actor …". */
  possessive?: boolean;
}

const SHARE_CREATED = "share_created";
const SHARE_OPENED = "share_opened";
const SHARE_REVOKED = "share_revoked";

const ACTIONS: Record<string, ActionMeta> = {
  [AuditAction.CREATED]: { label: "Created", tone: "success", verb: "created", withNoun: true },
  [AuditAction.UPDATED]: { label: "Updated", tone: "warn", verb: "updated", withNoun: true },
  [AuditAction.DELETED]: { label: "Deleted", tone: "danger", verb: "deleted", withNoun: true },
  [AuditAction.ACCESSED]: { label: "Revealed", tone: "violet", verb: "revealed secrets of", withNoun: true },
  [AuditAction.REVEALED]: { label: "Revealed", tone: "violet", verb: "revealed", withNoun: true },
  [AuditAction.COPIED]: { label: "Copied", tone: "info", verb: "copied", withNoun: true },
  [AuditAction.EXPORTED]: { label: "Exported", tone: "warn", verb: "exported", withNoun: true },
  [AuditAction.INVITED]: { label: "Invited", tone: "accent", verb: "invited" },
  [AuditAction.REMOVED]: { label: "Removed", tone: "danger", verb: "removed" },
  [AuditAction.ROLE_CHANGED]: { label: "Role changed", tone: "neutral", verb: "changed the role of" },
  [AuditAction.LOGIN]: { label: "Sign-in", tone: "neutral", verb: "signed in", noTarget: true },
  [AuditAction.LOGOUT]: { label: "Sign-out", tone: "neutral", verb: "signed out", noTarget: true },
  [AuditAction.LOGIN_FAILED]: { label: "Failed sign-in", tone: "danger", verb: "failed to sign in", noTarget: true },
  [AuditAction.PASSWORD_CHANGED]: { label: "Password changed", tone: "neutral", verb: "changed their password", noTarget: true },
  [AuditAction.TWO_FACTOR_ENABLED]: {
    label: "2FA enabled",
    tone: "success",
    verb: "enabled two-factor authentication",
    noTarget: true,
  },
  [AuditAction.TWO_FACTOR_DISABLED]: {
    label: "2FA disabled",
    tone: "warn",
    verb: "disabled two-factor authentication",
    noTarget: true,
  },
  [AuditAction.SESSION_REVOKED]: { label: "Session revoked", tone: "neutral", verb: "revoked a session", noTarget: true },
  [SHARE_CREATED]: { label: "Share created", tone: "accent", verb: "created a share link" },
  [SHARE_OPENED]: { label: "Share opened", tone: "info", verb: "share link was opened", possessive: true, noTarget: true },
  [SHARE_REVOKED]: { label: "Share revoked", tone: "neutral", verb: "revoked a share link" },
};

/** Action filter options, grouped. `revealed`/`copied` are reserved and never emitted, so they are not offered. */
export const ACTION_GROUPS: { label: string; actions: string[] }[] = [
  {
    label: "Projects & credentials",
    actions: [AuditAction.CREATED, AuditAction.UPDATED, AuditAction.DELETED, AuditAction.ACCESSED, AuditAction.EXPORTED],
  },
  { label: "Members", actions: [AuditAction.INVITED, AuditAction.REMOVED, AuditAction.ROLE_CHANGED] },
  {
    label: "Account & sign-in",
    actions: [
      AuditAction.LOGIN,
      AuditAction.LOGOUT,
      AuditAction.LOGIN_FAILED,
      AuditAction.PASSWORD_CHANGED,
      AuditAction.TWO_FACTOR_ENABLED,
      AuditAction.TWO_FACTOR_DISABLED,
      AuditAction.SESSION_REVOKED,
    ],
  },
  { label: "Share links", actions: [SHARE_CREATED, SHARE_OPENED, SHARE_REVOKED] },
];

const RESOURCES: Record<string, { label: string; noun: string }> = {
  [AuditResource.PROJECT]: { label: "Project", noun: "project" },
  [AuditResource.CREDENTIAL]: { label: "Credential", noun: "credential" },
  [AuditResource.MEMBER]: { label: "Member", noun: "member" },
  [AuditResource.ORGANIZATION]: { label: "Organization", noun: "organization" },
  [AuditResource.USER]: { label: "User", noun: "user" },
  [AuditResource.SESSION]: { label: "Session", noun: "session" },
  [AuditResource.ACCOUNT]: { label: "Account", noun: "account" },
  [AuditResource.SHARE]: { label: "Share link", noun: "share link" },
};

export const RESOURCE_TYPES = Object.keys(RESOURCES);

const humanize = (value: string) => {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "Unknown";
};

export function actionLabel(action: string): string {
  return ACTIONS[action]?.label ?? humanize(action);
}

export function actionTone(action: string): BadgeTone {
  return ACTIONS[action]?.tone ?? "neutral";
}

export function resourceLabel(resourceType: string): string {
  return RESOURCES[resourceType]?.label ?? humanize(resourceType);
}

const detailString = (event: AuditEvent, key: string): string | undefined => {
  const value = event.details?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
};

const NAME_KEYS = ["credentialName", "projectName", "label", "organizationName", "targetUsername", "removedUsername", "email"];

/** Human name of the affected resource, when the event recorded one. */
export function resourceName(event: AuditEvent): string | undefined {
  for (const key of NAME_KEYS) {
    const value = detailString(event, key);
    if (value) return value;
  }
  return undefined;
}

/** Display name of whoever performed the action. */
export function actorName(event: AuditEvent, people: ReadonlyMap<string, string>): string {
  return (event.userId && people.get(event.userId)) || detailString(event, "username") || "Unknown user";
}

export interface EventSentence {
  possessive: boolean;
  verb: string;
  /** Resource name (or short id), rendered in mono. */
  target?: string;
  /** Trailing context, e.g. "as viewer" or "(invalid password)". */
  suffix?: string;
}

const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 12)}…` : id);

/** Builds "<actor> created credential payments-db as …" from an event. */
export function describeEvent(event: AuditEvent): EventSentence {
  const meta = ACTIONS[event.action];
  const noun = RESOURCES[event.resourceType]?.noun ?? event.resourceType.replace(/[_-]+/g, " ");
  const verb = meta ? (meta.withNoun ? `${meta.verb} ${noun}` : meta.verb) : `${event.action.replace(/[_-]+/g, " ")} ${noun}`;

  let target: string | undefined;
  if (!meta?.noTarget) {
    target = resourceName(event) ?? (event.resourceId ? shortId(event.resourceId) : undefined);
  }

  let suffix: string | undefined;
  const role = detailString(event, "role");
  const newRole = detailString(event, "newRole");
  const reason = detailString(event, "reason");
  if (event.action === AuditAction.INVITED && role) suffix = `as ${role}`;
  else if (event.action === AuditAction.ROLE_CHANGED && newRole) suffix = `to ${newRole}`;
  else if (event.action === AuditAction.LOGIN_FAILED && reason) suffix = `(${reason.replace(/[_-]+/g, " ")})`;

  return { possessive: meta?.possessive ?? false, verb, target, suffix };
}

// ===== Filtering =====

/** Local midnight of a YYYY-MM-DD string, or null when invalid. */
export function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** [start, end) bounds in ms for the from/to filters. */
export function dateBounds(filters: Pick<AuditFilters, "from" | "to">): { start: number | null; end: number | null } {
  const from = parseDay(filters.from);
  const to = parseDay(filters.to);
  let end: number | null = null;
  if (to) {
    to.setDate(to.getDate() + 1);
    end = to.getTime();
  }
  return { start: from ? from.getTime() : null, end };
}

/** Client-side filter applied on top of the server's results (date range, free text, and anything the server ignored). */
export function matchesFilters(event: AuditEvent, filters: AuditFilters, actor: string): boolean {
  if (filters.action && event.action !== filters.action) return false;
  if (filters.resource && event.resourceType !== filters.resource) return false;
  if (filters.user && event.userId !== filters.user) return false;

  const { start, end } = dateBounds(filters);
  if (start !== null || end !== null) {
    const time = Date.parse(event.timestamp);
    if (start !== null && time < start) return false;
    if (end !== null && time >= end) return false;
  }

  const term = filters.search.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    actor,
    event.action,
    actionLabel(event.action),
    event.resourceType,
    resourceLabel(event.resourceType),
    event.resourceId ?? "",
    event.ipAddress ?? "",
    event.details ? JSON.stringify(event.details) : "",
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(term);
}

// ===== Time =====

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "medium" });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** "Just now", "12 min ago", "3 h ago"; older events show the clock time (the day is in the group header). */
export function relativeTime(timestamp: string, now: number): string {
  const time = Date.parse(timestamp);
  const diff = Math.max(0, now - time);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 12) return `${hours} h ago`;
  return clockFormat.format(time);
}

export function absoluteTime(timestamp: string): string {
  return fullFormat.format(Date.parse(timestamp));
}

/** "Today", "Yesterday" or "Mon, 2 Nov 2026". */
export function dayLabel(timestamp: string, now: number): string {
  const day = startOfDay(Date.parse(timestamp));
  const today = startOfDay(now);
  if (day === today) return "Today";
  if (day === startOfDay(today - 1)) return "Yesterday";
  return dayFormat.format(day);
}

export function dayKey(timestamp: string): number {
  return startOfDay(Date.parse(timestamp));
}
