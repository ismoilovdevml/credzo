"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, AlertTriangle, Download, RotateCw, ShieldOff } from "lucide-react";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { notify } from "@/components/Toast";
import { useSession } from "@/components/shell/SessionProvider";
import { api } from "@/lib/api-client";
import { buildAuditCsv, downloadCsv } from "./audit-csv";
import { AuditEventList } from "./AuditEventList";
import { AuditFilters } from "./AuditFilters";
import { AuditLogSkeleton, AuditRowsSkeleton } from "./AuditLogSkeleton";
import {
  FILTER_KEYS,
  actorName,
  dateRange,
  type AuditEvent,
  type AuditFilters as Filters,
  type Person,
} from "./audit-model";
import { useAuditEvents, type AuditQuery } from "./useAuditEvents";

const PLATFORM_SCOPE = "all";
const NOW_TICK_MS = 60_000;

const text = (value: unknown) => (typeof value === "string" ? value : "");

interface PersonRow {
  user?: { id?: unknown; username?: unknown; email?: unknown; firstName?: unknown; lastName?: unknown } | null;
}

/** Members (or all platform users) → id/name pairs for actor names and the Person filter. */
async function fetchPeople(scope: string, signal: AbortSignal): Promise<Person[]> {
  const url = scope === PLATFORM_SCOPE ? "/api/users" : `/api/organizations/${encodeURIComponent(scope)}/members`;
  const rows = await api.get<PersonRow[]>(url, { signal });
  const people: Person[] = [];
  for (const { user } of rows) {
    if (!user || !text(user.id)) continue;
    const name = `${text(user.firstName)} ${text(user.lastName)}`.trim() || text(user.username) || text(user.email);
    people.push({ id: text(user.id), name: name || text(user.id) });
  }
  return people.sort((a, b) => a.name.localeCompare(b.name));
}

const numberFormat = new Intl.NumberFormat("en-US");

export function AuditLogScreen() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<Filters>(() => {
    const read = (key: string) => searchParams.get(key)?.trim() ?? "";
    return {
      search: read("search"),
      action: read("action"),
      resource: read("resource"),
      user: read("user"),
      from: read("from"),
      to: read("to"),
    };
  }, [searchParams]);

  const updateFilters = useCallback(
    (patch: Partial<Filters>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const clearFilters = useCallback(() => {
    updateFilters(Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])));
  }, [updateFilters]);

  const scope = session.organization?.id ?? (session.isPlatformAdmin ? PLATFORM_SCOPE : null);
  const allowed = !session.loading && session.isAdmin && scope !== null;

  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    if (!allowed || !scope) return;
    const controller = new AbortController();
    fetchPeople(scope, controller.signal)
      .then(setPeople)
      .catch(() => {
        // Names are a nicety: rows fall back to recorded usernames when this fails.
      });
    return () => controller.abort();
  }, [allowed, scope]);

  const sessionUser = session.user;
  const actorFor = useMemo(() => {
    const names = new Map(people.map((person) => [person.id, person.name]));
    if (sessionUser && !names.has(sessionUser.id)) names.set(sessionUser.id, sessionUser.name);
    return (event: AuditEvent) => actorName(event, names);
  }, [people, sessionUser]);

  const query = useMemo<AuditQuery | null>(() => {
    if (!allowed || !scope) return null;
    return {
      scope,
      action: filters.action,
      resourceType: filters.resource,
      userId: filters.user,
      search: filters.search,
      ...dateRange(filters),
    };
  }, [allowed, scope, filters]);
  const audit = useAuditEvents(query);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const exportCsv = () => {
    const csv = buildAuditCsv(audit.events, actorFor);
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = session.organization?.slug || PLATFORM_SCOPE;
    downloadCsv(csv, `credzo-audit-${slug}-${stamp}.csv`);
    notify.success(`Exported ${numberFormat.format(audit.events.length)} ${audit.events.length === 1 ? "event" : "events"}`);
  };

  if (session.loading) return <AuditLogSkeleton />;

  if (!allowed || audit.error?.status === 403) {
    return (
      <div className="flex flex-col gap-[22px]">
        <PageHeader title="Audit log" />
        <EmptyState
          icon={<ShieldOff />}
          title="You don’t have access to the audit log"
          description={
            scope === null
              ? "The audit log belongs to an organization. Join or switch to one where you’re an owner or admin."
              : "Only organization owners and admins can view audit events. Ask an admin if you need a record of activity."
          }
          data-testid="audit-access-denied"
        />
      </div>
    );
  }

  const selectedUserLabel = filters.user
    ? (() => {
        const match = audit.events.find((event) => event.userId === filters.user);
        return match ? actorFor(match) : undefined;
      })()
    : undefined;

  const filtering = Object.values(filters).some(Boolean);
  const loaded = audit.events.length;
  const summary =
    audit.total !== null
      ? `Showing ${numberFormat.format(loaded)} of ${numberFormat.format(Math.max(audit.total, loaded))} events`
      : `Showing ${numberFormat.format(loaded)} ${loaded === 1 ? "event" : "events"}`;

  const orgName = session.organization?.name;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="Audit log"
        description={`Every action in ${orgName ?? "all organizations"}. Entries can’t be edited or deleted.`}
        actions={
          <Button
            variant="secondary"
            leftIcon={<Download />}
            onClick={exportCsv}
            disabled={audit.loading || loaded === 0}
            title="Download the events shown below as CSV"
            data-testid="audit-export-csv"
          >
            Export CSV
          </Button>
        }
      />

      <AuditFilters
        filters={filters}
        onChange={updateFilters}
        onClear={clearFilters}
        people={people}
        selectedUserLabel={selectedUserLabel}
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface" aria-busy={audit.loading || undefined}>
        {audit.loading ? (
          <AuditRowsSkeleton />
        ) : audit.error ? (
          <EmptyState
            bare
            icon={<AlertTriangle />}
            title="Couldn’t load the audit log"
            description={audit.error.message}
            action={
              <Button variant="secondary" size="sm" leftIcon={<RotateCw />} onClick={audit.retry}>
                Try again
              </Button>
            }
            data-testid="audit-error"
          />
        ) : loaded === 0 ? (
          <EmptyState
            bare
            icon={<Activity />}
            title={filtering ? "No events match these filters" : "No activity yet"}
            description={
              filtering
                ? "Try a different person, action or date range."
                : "Sign-ins, credential reveals and changes will be recorded here."
            }
            action={
              filtering ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
            data-testid="audit-empty"
          />
        ) : (
          <>
            <AuditEventList events={audit.events} actorFor={actorFor} now={now} />
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13.5px] text-muted">
              <span aria-live="polite" data-testid="audit-count">
                {summary}
              </span>
              {audit.hasMore && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={audit.loadingMore}
                  onClick={() => void audit.loadMore()}
                  data-testid="audit-load-more"
                >
                  Load more
                </Button>
              )}
            </div>
            {audit.loadMoreError && (
              <p role="alert" className="px-5 pb-3 text-[13px] font-medium text-danger">
                {audit.loadMoreError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
