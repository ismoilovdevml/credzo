import { actionLabel, resourceLabel, resourceName, type AuditEvent } from "./audit-model";

const HEADER = [
  "Timestamp (UTC)",
  "Actor",
  "Actor ID",
  "Action",
  "Action code",
  "Resource type",
  "Resource",
  "Resource ID",
  "IP address",
  "User agent",
  "Details",
];

/**
 * RFC 4180 cell: quoted when it contains a comma, quote or line break, quotes doubled.
 * Cells that a spreadsheet would evaluate as a formula get a leading apostrophe (CSV injection).
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildAuditCsv(events: AuditEvent[], actorFor: (event: AuditEvent) => string): string {
  const rows = events.map((event) => [
    event.timestamp,
    actorFor(event),
    event.userId,
    actionLabel(event.action),
    event.action,
    resourceLabel(event.resourceType),
    resourceName(event) ?? "",
    event.resourceId ?? "",
    event.ipAddress ?? "",
    event.userAgent ?? "",
    event.details ? JSON.stringify(event.details) : "",
  ]);
  return [HEADER, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Saves the CSV through a temporary object URL. The BOM makes Excel read it as UTF-8. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
