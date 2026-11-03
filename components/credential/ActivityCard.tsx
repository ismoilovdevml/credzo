"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Skeleton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api-client";
import type { AuditLog } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatAgo, formatDateTime } from "./format";

const MAX_EVENTS = 8;

const CHANGE_LABELS: Record<string, string> = {
  name: "name",
  type: "service type",
  description: "description",
  environment: "environment",
  rotationDays: "rotation period",
  linkedServers: "linked servers",
  fields: "fields",
};

function describe(log: AuditLog): string {
  switch (log.action) {
    case "created":
      return "created this credential";
    case "accessed":
    case "revealed":
      return "revealed secrets";
    case "copied":
      return "copied a secret";
    case "deleted":
      return "deleted this credential";
    case "updated": {
      if (log.details?.rotated === true) return "marked this credential rotated";
      const changes = log.details?.changes;
      const keys =
        changes && typeof changes === "object" ? Object.keys(changes).map((key) => CHANGE_LABELS[key] ?? key) : [];
      return keys.length > 0 ? `edited ${keys.join(", ")}` : "edited this credential";
    }
    default:
      return log.action.replace(/_/g, " ");
  }
}

type ActivityState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; events: AuditLog[] };

export interface ActivityCardProps {
  credentialId: string;
  organizationId: string;
  now: number;
  /** Display name for a user id ("You", a member name), or null when unknown. */
  resolveName: (userId: string) => string | null;
}

/** Recent audit events for one credential (org owners / admins only). */
export function ActivityCard({ credentialId, organizationId, now, resolveName }: ActivityCardProps) {
  const [state, setState] = useState<ActivityState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ resourceType: "credential", resourceId: credentialId, limit: String(MAX_EVENTS) });
    api
      .get<{ logs: AuditLog[] }>(`/api/organizations/${encodeURIComponent(organizationId)}/audit?${query}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", events: data.logs });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: errorMessage(error, "Couldn't load activity") });
      });
    return () => {
      cancelled = true;
    };
  }, [credentialId, organizationId]);

  return (
    <Card data-testid="credential-activity">
      <CardHeader
        title="Recent activity"
        description="Reveals and edits recorded in the audit log."
        actions={
          <Link href="/dashboard/audit" className="text-[13.5px] font-semibold text-accent-ink hover:underline">
            Audit log
          </Link>
        }
      />
      <div className="px-5 py-4">
        {state.status === "loading" && (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading activity">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-[14px] text-danger">
            {state.message}
          </p>
        )}
        {state.status === "ready" && state.events.length === 0 && (
          <p className="text-[14px] text-muted">No recorded activity for this credential yet.</p>
        )}
        {state.status === "ready" && state.events.length > 0 && (
          <ol className="ml-1.5 flex flex-col border-l-2 border-line" data-testid="activity-list">
            {state.events.map((log, index) => (
              <li key={log.id} className="relative pb-3.5 pl-4 text-[14px] leading-relaxed text-ink last:pb-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -left-[6px] top-[6px] h-2.5 w-2.5 rounded-full",
                    index === 0 ? "bg-accent" : "bg-muted"
                  )}
                />
                <strong className="font-semibold">{resolveName(log.userId) ?? "Unknown user"}</strong> {describe(log)}{" "}
                <span className="text-muted">
                  · <time dateTime={log.timestamp} title={formatDateTime(log.timestamp)}>{formatAgo(log.timestamp, now)}</time>
                  {log.ipAddress && ` · ${log.ipAddress}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
