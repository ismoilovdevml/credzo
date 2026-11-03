"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FolderPlus, KeyRound } from "lucide-react";
import { Button, EmptyState, PageHeader, Skeleton, StatCard, type StatCardProps } from "@/components/ui";
import { useSession } from "@/components/shell/SessionProvider";
import { AUDIT_CONFIG } from "@/lib/config/constants";
import type { AuditLog } from "@/lib/types";
import { AuditActivity, RecentlyUpdated, type AuditFeedState } from "./ActivityFeed";
import { api, errorMessage } from "@/lib/api-client";
import { EnvironmentSummary } from "./EnvironmentSummary";
import {
  DAY,
  dueForRotation,
  environmentTotals,
  greetingFor,
  pluralize,
  rotationSchedule,
  shortName,
  type DashboardCredential,
  type OrganizationPerson,
  type ProjectSummary,
} from "./insights";
import { QuickActions } from "./QuickActions";
import { RecentProjects } from "./RecentProjects";
import { RotationDueList } from "./RotationDueList";

const ACTIVITY_LIMIT = 8;
const REVEAL_WINDOW_DAYS = 7;

/** Every state is tagged with the request key it answers, so a stale response reads as "loading". */
type VaultState =
  | { key: string; status: "error"; message: string }
  | { key: string; status: "ready"; projects: ProjectSummary[]; credentials: DashboardCredential[]; loadedAt: number };

interface RevealStats {
  count: number;
  credentials: number;
  /** The sample hit the API page limit, so the real count may be higher. */
  capped: boolean;
}

type AuditState =
  | { key: string; status: "error"; message: string }
  | { key: string; status: "ready"; logs: AuditLog[]; people: Map<string, string>; reveals: RevealStats };

function countReveals(logs: AuditLog[], now: number): RevealStats {
  const since = now - REVEAL_WINDOW_DAYS * DAY;
  const recent = logs.filter((log) => Date.parse(log.timestamp) >= since);
  return {
    count: recent.length,
    credentials: new Set(recent.map((log) => log.resourceId ?? log.id)).size,
    capped: logs.length >= AUDIT_CONFIG.MAX_LIMIT && recent.length === logs.length,
  };
}

/** StatCard with a stable test id (StatCard itself does not forward extra props). */
function Stat({ testId, ...props }: StatCardProps & { testId: string }) {
  return (
    <div data-testid={testId} className="flex min-w-0">
      <StatCard {...props} className="flex-1" />
    </div>
  );
}

const rowClass = "flex flex-wrap items-start gap-5";
const wideColumn = "flex min-w-0 flex-[3_1_520px] flex-col gap-5";
const narrowColumn = "flex min-w-0 flex-[2_1_340px] flex-col gap-5";

export function Overview() {
  const { user, organization, isAdmin, loading: sessionLoading } = useSession();
  const [clock] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [auditState, setAuditState] = useState<AuditState | null>(null);

  const organizationId = organization?.id ?? null;
  const auditOrganizationId = isAdmin && organizationId ? organizationId : null;
  const requestKey = `${organizationId ?? "personal"}:${attempt}`;

  useEffect(() => {
    if (sessionLoading) return;
    const controller = new AbortController();
    Promise.all([
      api.get<ProjectSummary[]>("/api/projects", { signal: controller.signal }),
      api.get<DashboardCredential[]>("/api/credentials", { signal: controller.signal }),
    ])
      .then(([projects, credentials]) =>
        setVaultState({ key: requestKey, status: "ready", projects, credentials, loadedAt: Date.now() })
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setVaultState({ key: requestKey, status: "error", message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [sessionLoading, requestKey]);

  useEffect(() => {
    if (!auditOrganizationId) return;
    const controller = new AbortController();
    const base = `/api/organizations/${encodeURIComponent(auditOrganizationId)}`;
    const revealQuery = new URLSearchParams({
      action: "accessed",
      resourceType: "credential",
      limit: String(AUDIT_CONFIG.MAX_LIMIT),
    });
    Promise.all([
      api.get<{ logs: AuditLog[] }>(`${base}/audit?limit=${ACTIVITY_LIMIT}`, { signal: controller.signal }),
      api.get<OrganizationPerson[]>(`${base}/members`, { signal: controller.signal }),
      api.get<{ logs: AuditLog[] }>(`${base}/audit?${revealQuery}`, { signal: controller.signal }),
    ])
      .then(([activity, members, reveals]) => {
        const people = new Map<string, string>();
        for (const member of members) {
          const name = shortName(member.user);
          if (name) people.set(member.userId, name);
        }
        setAuditState({
          key: requestKey,
          status: "ready",
          logs: activity.logs,
          people,
          reveals: countReveals(reveals.logs, Date.now()),
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setAuditState({ key: requestKey, status: "error", message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [auditOrganizationId, requestKey]);

  const vault = vaultState?.key === requestKey ? vaultState : null;
  const audit = auditState?.key === requestKey ? auditState : null;
  const ready = vault?.status === "ready" ? vault : null;
  const now = ready?.loadedAt ?? clock;

  const derived = useMemo(() => {
    if (!ready) return null;
    const schedule = rotationSchedule(ready.credentials, ready.loadedAt);
    const weekAgo = ready.loadedAt - 7 * DAY;
    return {
      schedule,
      due: dueForRotation(schedule),
      totals: environmentTotals(ready.credentials),
      projectNames: new Map(ready.projects.map((project) => [project.id, project.name])),
      addedThisWeek: ready.credentials.filter((credential) => Date.parse(credential.createdAt) >= weekAgo).length,
      productionProjects: ready.projects.filter((project) => project.environments.production > 0).length,
    };
  }, [ready]);

  const firstName = user?.firstName.trim() || user?.name || "";
  const header = (
    <PageHeader
      title={
        user ? (
          <span data-testid="overview-greeting">
            {greetingFor(clock)}, {firstName}
          </span>
        ) : (
          <Skeleton className="h-8 w-64 max-w-full" />
        )
      }
      description={
        user &&
        (organization ? `Here’s the state of the ${organization.name} vault.` : "Here’s the state of your vault.")
      }
    />
  );

  if (vault?.status === "error") {
    return (
      <div className="flex flex-col gap-7">
        {header}
        <EmptyState
          icon={<AlertTriangle />}
          title="Couldn't load your overview"
          description={vault.message}
          action={
            <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (ready && ready.projects.length === 0) {
    return (
      <div className="flex flex-col gap-7">
        {header}
        <EmptyState
          icon={<FolderPlus />}
          title="Create your first project"
          description="Projects keep the credentials for one app or service together: servers, databases, API keys and more."
          className="py-16"
          action={
            <>
              <Button asChild leftIcon={<FolderPlus className="h-4 w-4" />}>
                <Link href="/dashboard/projects/new" data-testid="overview-create-project">
                  Create a project
                </Link>
              </Button>
              <Button asChild variant="secondary" leftIcon={<KeyRound className="h-4 w-4" />}>
                <Link href="/dashboard/generator">Generate a password</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const credentials = ready?.credentials ?? null;
  const overdue = derived?.due.filter((item) => item.overdue).length ?? 0;
  const reveals = audit?.status === "ready" ? audit.reveals : null;
  const feed: AuditFeedState = !audit
    ? { status: "loading" }
    : audit.status === "error"
      ? { status: "error", message: audit.message }
      : { status: "ready", logs: audit.logs, people: audit.people };

  return (
    <div className="flex flex-col gap-7">
      {header}

      <section aria-label="Key figures" className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        <Stat
          testId="stat-projects"
          label="Projects"
          value={ready?.projects.length.toLocaleString()}
          hint={
            derived &&
            (derived.productionProjects > 0
              ? `${derived.productionProjects.toLocaleString()} with production credentials`
              : "No production credentials yet")
          }
        />
        <Stat
          testId="stat-credentials"
          label="Credentials"
          value={credentials?.length.toLocaleString()}
          hint={
            derived &&
            (derived.addedThisWeek > 0 ? `+${derived.addedThisWeek.toLocaleString()} this week` : "None added this week")
          }
          hintTone={derived && derived.addedThisWeek > 0 ? "accent" : "muted"}
        />
        <Stat
          testId="stat-rotation"
          label="Due for rotation"
          value={derived?.due.length.toLocaleString()}
          hint={
            derived &&
            (overdue > 0
              ? `${overdue.toLocaleString()} overdue`
              : derived.schedule.length > 0
                ? `${pluralize(derived.schedule.length, "credential")} on a schedule`
                : "No rotation policies set")
          }
          hintTone={overdue > 0 ? "danger" : "muted"}
        />
        {auditOrganizationId ? (
          <Stat
            testId="stat-reveals"
            label={`Reveals · last ${REVEAL_WINDOW_DAYS} days`}
            value={audit?.status === "error" ? "—" : reveals ? `${reveals.count.toLocaleString()}${reveals.capped ? "+" : ""}` : undefined}
            hint={
              audit?.status === "error"
                ? "Couldn't load audit data"
                : reveals &&
                  (reveals.count > 0 ? `Across ${pluralize(reveals.credentials, "credential")}` : "No secrets revealed")
            }
          />
        ) : (
          <Stat
            testId="stat-production"
            label="Production credentials"
            value={derived?.totals.production.toLocaleString()}
            hint={
              derived &&
              (credentials && credentials.length > 0
                ? `${Math.round((derived.totals.production / credentials.length) * 100)}% of all credentials`
                : "No credentials yet")
            }
          />
        )}
      </section>

      <div className={rowClass}>
        <div className={wideColumn}>
          <RecentProjects projects={ready?.projects ?? null} now={now} />
        </div>
        <div className={narrowColumn}>
          <RotationDueList due={derived?.due ?? null} scheduledCount={derived?.schedule.length ?? 0} />
        </div>
      </div>

      <div className={rowClass}>
        <div className={wideColumn}>
          {auditOrganizationId ? (
            <AuditActivity
              feed={feed}
              now={now}
              currentUserId={user?.id ?? null}
              projectNames={derived?.projectNames ?? new Map()}
            />
          ) : (
            <RecentlyUpdated credentials={credentials} now={now} />
          )}
        </div>
        <div className={narrowColumn}>
          <EnvironmentSummary totals={derived?.totals ?? null} />
          <QuickActions showMembers={isAdmin && organizationId !== null} />
        </div>
      </div>
    </div>
  );
}
