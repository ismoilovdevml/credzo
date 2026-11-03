import { useEffect, useState } from "react";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const EXPIRY_OPTIONS = [
  { value: "1h", label: "1 h" },
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 d" },
] as const;
export type ExpiryOption = (typeof EXPIRY_OPTIONS)[number]["value"];

export const VIEW_OPTIONS = [
  { value: "1", label: "1 view" },
  { value: "3", label: "3 views" },
] as const;
export type ViewOption = (typeof VIEW_OPTIONS)[number]["value"];

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function compactDuration(ms: number): string {
  if (ms < MINUTE) return "<1 min";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h`;
  return `${Math.floor(ms / DAY)} d`;
}

/** "18 h left", "35 min left". */
export function formatTimeLeft(iso: string, now: number): string {
  return `${compactDuration(Math.max(0, new Date(iso).getTime() - now))} left`;
}

/** "2 h ago", "just now". */
export function formatAgo(iso: string, now: number): string {
  const elapsed = now - new Date(iso).getTime();
  return elapsed < MINUTE ? "just now" : `${compactDuration(elapsed)} ago`;
}

/** Locale date + time, e.g. for tooltips. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Current timestamp that refreshes every `intervalMs` (for "x h left" labels). */
export function useNow(intervalMs = MINUTE): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
