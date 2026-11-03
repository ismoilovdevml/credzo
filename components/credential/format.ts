import type { BadgeTone } from "@/components/ui";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Rotation is flagged "due soon" this many days before the due date. */
const DUE_SOON_DAYS = 14;

/** "4 Mar 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "4 Mar 2026, 14:05" — for tooltips and <time title>. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function pluralize(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** "just now", "4 min ago", "3 h ago", "yesterday", "12 days ago", then a date. */
export function formatAgo(iso: string, now: number): string {
  const elapsed = now - new Date(iso).getTime();
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  const days = Math.floor(elapsed / DAY);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

export interface RotationStatus {
  /** ISO date the secret should next be rotated. */
  dueAt: string;
  /** Whole days until due; negative when overdue. */
  daysLeft: number;
  state: "ok" | "due" | "overdue";
  label: string;
  tone: BadgeTone;
}

/** Rotation schedule derived from the policy and the last rotation (or creation) time. */
export function getRotationStatus(rotationDays: number, rotatedAt: string, now: number): RotationStatus {
  const due = new Date(rotatedAt).getTime() + rotationDays * DAY;
  const daysLeft = Math.ceil((due - now) / DAY);
  const dueAt = new Date(due).toISOString();

  if (due <= now) {
    const late = Math.max(1, -daysLeft);
    return { dueAt, daysLeft, state: "overdue", label: `Overdue by ${pluralize(late, "day")}`, tone: "danger" };
  }
  if (daysLeft <= DUE_SOON_DAYS) {
    return { dueAt, daysLeft, state: "due", label: daysLeft <= 1 ? "Due today" : `Due in ${daysLeft} days`, tone: "warn" };
  }
  return { dueAt, daysLeft, state: "ok", label: "On schedule", tone: "success" };
}

/** "in 78 days", "tomorrow", "3 days ago". */
export function formatDaysFromNow(daysLeft: number): string {
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  if (daysLeft > 0) return `in ${daysLeft} days`;
  return daysLeft === -1 ? "yesterday" : `${-daysLeft} days ago`;
}
