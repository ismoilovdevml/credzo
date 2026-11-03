"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, SegmentedControl, Skeleton, Spinner, StatCard } from "@/components/ui";
import { useSession } from "@/components/shell/SessionProvider";
import type { AdminStats, StatsRange } from "@/lib/types";
import { ActionBreakdown } from "./ActionBreakdown";
import { ActivityChart } from "./ActivityChart";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { RANGE_OPTIONS, RANGE_SHORT, parseRange, pluralize } from "./format";
import { SecurityAlerts } from "./SecurityAlerts";
import { SystemHealth } from "./SystemHealth";
import { TopContributors } from "./TopContributors";
import { UsersTable } from "./UsersTable";

/** Result of the last finished request, tagged with the range/reload key it answered. */
type Outcome = { key: string } & ({ kind: "ok" } | { kind: "forbidden" } | { kind: "error"; message: string });

function SectionSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <Card padded className={className} aria-hidden="true">
      <Skeleton className="mb-5 h-5 w-40" />
      <div className="flex flex-col gap-3.5">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    </Card>
  );
}

/** Admin dashboard: KPIs, activity, alerts and (for platform admins) system health and user management. */
export function AdminOverview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = parseRange(searchParams.get("range"));
  const { user, organization } = useSession();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${range}:${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    api.get<AdminStats>(`/api/admin/stats?range=${range}`, { signal: controller.signal })
      .then((data) => {
        setStats(data);
        setOutcome({ key: requestKey, kind: "ok" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setOutcome(
          error instanceof ApiError && error.status === 403
            ? { key: requestKey, kind: "forbidden" }
            : { key: requestKey, kind: "error", message: errorMessage(error, "Could not load admin statistics.") }
        );
      });
    return () => controller.abort();
  }, [range, requestKey]);

  const pending = outcome?.key !== requestKey;
  const loadError = !pending && outcome?.kind === "error" ? outcome.message : null;

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const changeRange = (next: StatsRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (outcome?.kind === "forbidden") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Admin overview" />
        <EmptyState
          icon={<ShieldAlert />}
          title="Admin access required"
          description="Only platform admins and organisation owners or admins can see this page. Ask an admin of your organisation if you need access."
          action={
            <Button asChild variant="secondary">
              <Link href="/dashboard">Back to overview</Link>
            </Button>
          }
          data-testid="admin-access-denied"
        />
      </div>
    );
  }

  const span = RANGE_SHORT[stats?.range ?? range];
  const isPlatform = stats?.scope === "platform";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {stats ? (
          <span className="w-fit rounded-full bg-ink px-2.5 py-1 text-xs font-semibold leading-none text-surface">
            {isPlatform ? "Platform admin" : "Organisation admin"}
          </span>
        ) : (
          <Skeleton className="h-5 w-28 rounded-full" />
        )}
        <PageHeader
          title="Admin overview"
          description={stats && !isPlatform && organization ? `Activity in ${organization.name}` : undefined}
          actions={
            <>
              {stats && pending && <Spinner className="h-4 w-4 text-muted" label="Updating" />}
              <SegmentedControl
                aria-label="Period"
                value={range}
                onChange={changeRange}
                options={RANGE_OPTIONS}
                data-testid="admin-range"
              />
            </>
          }
        />
      </div>

      {loadError ? (
        <EmptyState
          icon={<AlertTriangle />}
          title="Admin statistics could not be loaded"
          description={loadError}
          action={
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5" aria-busy={!stats}>
            <StatCard
              data-testid="admin-stat-users"
              label="Users"
              value={stats?.users.total.toLocaleString()}
              hint={stats && `${stats.users.activeInRange.toLocaleString()} active in ${span}`}
            />
            <StatCard
              data-testid="admin-stat-projects"
              label="Projects"
              value={stats?.projects.total.toLocaleString()}
              hint={
                stats &&
                (isPlatform
                  ? `${stats.projects.personal.toLocaleString()} personal`
                  : pluralize(stats.projects.organization, "shared project"))
              }
            />
            <StatCard
              data-testid="admin-stat-credentials"
              label="Credentials"
              value={stats?.credentials.total.toLocaleString()}
              hint={stats && `+${stats.credentials.newInRange.toLocaleString()} in ${span}`}
              hintTone={stats && stats.credentials.newInRange > 0 ? "accent" : "muted"}
            />
            <StatCard
              data-testid="admin-stat-events"
              label="Events"
              value={stats?.events.total.toLocaleString()}
              hint={stats && `in the last ${span}`}
            />
            <StatCard
              data-testid="admin-stat-failed"
              className="col-span-2 sm:col-span-1"
              label="Failed sign-ins"
              value={
                stats && (
                  <span className={stats.failedSignIns.total > 0 ? "text-danger" : undefined}>
                    {stats.failedSignIns.total.toLocaleString()}
                  </span>
                )
              }
              hint={
                stats &&
                (stats.failedSignIns.total > 0
                  ? `from ${pluralize(stats.failedSignIns.distinctIps, "IP")}`
                  : `None in the last ${span}`)
              }
              hintTone={stats && stats.failedSignIns.total > 0 ? "danger" : "muted"}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {stats ? (
              <>
                <ActivityChart activity={stats.activity} range={stats.range} />
                <ActionBreakdown breakdown={stats.actionBreakdown} />
              </>
            ) : (
              <>
                <SectionSkeleton rows={6} />
                <SectionSkeleton rows={5} />
              </>
            )}
          </div>

          <div className={isPlatform ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3" : "grid gap-5 md:grid-cols-2"}>
            {stats ? (
              <>
                {isPlatform && <SystemHealth system={stats.system} />}
                <TopContributors contributors={stats.topContributors} />
                <SecurityAlerts alerts={stats.securityAlerts} />
              </>
            ) : (
              <>
                <SectionSkeleton />
                <SectionSkeleton />
              </>
            )}
          </div>

          {isPlatform && <UsersTable currentUserId={user?.id ?? null} onUserDeleted={reload} />}
        </>
      )}
    </div>
  );
}
