import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Badge, Card, CardTitle, EmptyState } from "@/components/ui";
import type { SecurityAlert } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { alertAuditHref, formatDateTime } from "./format";

const TYPE_LABEL: Record<SecurityAlert["type"], string> = {
  brute_force: "Brute force",
  mass_reveal: "Bulk reveal",
};

/** Brute-force sign-in bursts and bulk secret reveals detected in the period, newest first. */
export function SecurityAlerts({ alerts }: { alerts: SecurityAlert[] }) {
  const hasAlerts = alerts.length > 0;
  return (
    <Card
      padded
      className={cn("flex flex-col gap-3.5", hasAlerts && "border-danger/30 bg-danger-soft/40")}
      data-testid="security-alerts"
    >
      <div className="flex items-center justify-between gap-3">
        <CardTitle className={cn("text-base", hasAlerts && "text-danger")}>Security alerts</CardTitle>
        {hasAlerts && (
          <Badge tone="danger" size="sm">
            {alerts.length}
          </Badge>
        )}
      </div>

      {hasAlerts ? (
        <ul className="flex flex-col divide-y divide-line-soft">
          {alerts.map((alert) => (
            <li
              key={`${alert.type}:${alert.subject}:${alert.firstSeen}`}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
              data-testid="security-alert"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={alert.severity === "high" ? "danger" : "warn"} size="sm" dot>
                  {alert.severity === "high" ? "High" : "Medium"}
                </Badge>
                <span className="text-[13px] font-semibold text-ink">{TYPE_LABEL[alert.type]}</span>
              </div>
              <p className="break-words text-[14px] leading-relaxed text-ink-2">{alert.message}</p>
              <p className="text-[12.5px] text-muted">
                First seen <time dateTime={alert.firstSeen}>{formatDateTime(alert.firstSeen)}</time>
                {" · "}
                Last seen <time dateTime={alert.lastSeen}>{formatDateTime(alert.lastSeen)}</time>
              </p>
              <Link
                href={alertAuditHref(alert)}
                className="inline-flex w-fit items-center gap-1 rounded-sm text-[14px] font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                Investigate in audit log
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          bare
          icon={<ShieldCheck />}
          title="No alerts in this period"
          description="Bursts of failed sign-ins and bulk secret reveals show up here."
          className="py-8"
        />
      )}
    </Card>
  );
}
