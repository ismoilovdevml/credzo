import type { SecurityAlert, StatsRange } from "@/lib/types";
import { STATS_RANGES } from "@/lib/types";

export const DEFAULT_RANGE: StatsRange = "7d";

/** Short span used in hints: "12 active in 7 days". */
export const RANGE_SHORT: Record<StatsRange, string> = {
  "24h": "24 h",
  "7d": "7 days",
  "30d": "30 days",
};

export const RANGE_OPTIONS = STATS_RANGES.map((value) => ({ value, label: RANGE_SHORT[value] }));

export function parseRange(value: string | null): StatsRange {
  return (STATS_RANGES as readonly string[]).includes(value ?? "") ? (value as StatsRange) : DEFAULT_RANGE;
}

/** "3 events", "1 event". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

/** 19293184 -> "18.4 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  accessed: "Secrets revealed",
  revealed: "Secrets revealed",
  copied: "Copied",
  exported: "Exported",
  invited: "Invited",
  removed: "Removed",
  role_changed: "Role changed",
  login: "Signed in",
  logout: "Signed out",
  login_failed: "Failed sign-in",
  password_changed: "Password changed",
  "2fa_enabled": "2FA enabled",
  "2fa_disabled": "2FA disabled",
  session_revoked: "Session revoked",
  share_created: "Share link created",
  share_opened: "Share link opened",
  share_revoked: "Share link revoked",
};

/** Human label for an audit action, e.g. "login_failed" -> "Failed sign-in". */
export function actionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  const words = action.replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : action;
}

/** Axis label for an activity bucket. Daily buckets are UTC midnights, so they are formatted in UTC. */
export function bucketLabel(iso: string, granularity: "hour" | "day", range: StatsRange): string {
  const date = new Date(iso);
  if (granularity === "hour") return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return range === "7d"
    ? date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Full bucket name for tooltips and the table fallback: "Mon, Nov 3" or "Nov 3, 14:00". */
export function bucketTitle(iso: string, granularity: "hour" | "day"): string {
  const date = new Date(iso);
  return granularity === "hour"
    ? date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "—";
  return new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "—";
  return new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Audit-log link for an alert: a bulk reveal filters to that user's reveals; a brute-force
 * burst searches failed sign-ins for its subject (a username or IP address).
 */
export function alertAuditHref(alert: SecurityAlert): string {
  const params = new URLSearchParams();
  if (alert.type === "brute_force") {
    params.set("action", "login_failed");
    params.set("search", alert.subject);
  } else {
    params.set("action", "accessed");
    if (alert.userId) params.set("user", alert.userId);
  }
  return `/dashboard/audit?${params.toString()}`;
}
