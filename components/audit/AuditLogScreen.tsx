"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, AlertTriangle, Download, RotateCw, ShieldOff } from "lucide-react";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { notify } from "@/components/Toast";
import { useSession } from "@/components/shell/SessionProvider";
import { buildAuditCsv, downloadCsv } from "./audit-csv";
import { AuditEventList } from "./AuditEventList";
import { AuditFilters } from "./AuditFilters";
import { AuditLogSkeleton, AuditRowsSkeleton } from "./AuditLogSkeleton";
import {
  FILTER_KEYS,
  dateBounds,
  matchesFilters,
  actorName,
  type AuditEvent,
  type AuditFilters as Filters,
  type Person,
} from "./audit-model";
import { SEARCH_LIMIT, useAuditEvents, type AuditQuery } from "./useAuditEvents";

const PLATFORM_SCOPE = "all";
const NOW_TICK_MS = 60_000;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Members (or all platform users) → id/name pairs for actor names and the Person filter. */
async function fetchPeople(scope: string, signal: AbortSignal): Promise<Person[]> {
  const url = scope === PLATFORM_SCOPE ? "/api/users" : `/api/organizations/${encodeURIComponent(scope)}/members`;
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(payload) || !Array.isArray(payload.data)) return [];
  const people: Person[] = [];
  for (const item of payload.data) {
    const user = isObject(item) && isObject(item.user) ? item.user : null;
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

  // The API's search ignores the other filters and pagination, so while searching they are
  // applied client-side; the platform-wide log has no server search at all.
  const serverSearch = scope === PLATFORM_SCOPE ? "" : filters.search;
  const query = useMemo<AuditQuery | null>(() => {
    if (!allowed || !scope) return null;
    if (serverSearch) return { scope, action: "", resourceType: "", userId: "", search: serverSearch };
    return { scope, action: filters.action, resourceType: filters.resource, userId: filters.user, search: "" };
  }, [allowed, scope, serverSearch, filters.action, filters.resource, filters.user]);
  const audit = useAuditEvents(query);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(
    () => audit.events.filter((event) => matchesFilters(event, filters, actorFor(event))),
    [audit.events, filters, actorFor]
  );

  // Events arrive newest first: once the oldest loaded one predates "from", later pages can't match.
  const { start } = dateBounds(filters);
  const oldest = audit.events[audit.events.length - 1];
  const pastRange = start !== null && oldest !== undefined && Date.parse(oldest.timestamp) < start;
  const canLoadMore = audit.hasMore && !pastRange;

  const exportCsv = () => {
    const csv = buildAuditCsv(visible, actorFor);
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = session.organization?.slug || PLATFORM_SCOPE;
    downloadCsv(csv, `credzo-audit-${slug}-${stamp}.csv`);
    notify.success(`Exported ${numberFormat.format(visible.length)} ${visible.length === 1 ? "event" : "events"}`);
  };

  if (session.loading) return <AuditLogSkeleton />;

  if (!allowed || audit.error?.status === 403) {
    return (
      <div className="flex flex-col gap-[22px]">
        <PageHeader title="Audit log" />
        <div data-testid="audit-access-denied">
          <EmptyState
            icon={<ShieldOff />}
            title="You don’t have access to the audit log"
            description={
              scope === null
                ? "The audit log belongs to an organization. Join or switch to one where you’re an owner or admin."
                : "Only organization owners and admins can view audit events. Ask an admin if you need a record of activity."
            }
          />
        </div>
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
  let summary: string;
  if (visible.length !== loaded) {
    summary = `Showing ${numberFormat.format(visible.length)} matching of ${numberFormat.format(loaded)} loaded events`;
  } else if (audit.total !== null) {
    summary = `Showing ${numberFormat.format(loaded)} of ${numberFormat.format(Math.max(audit.total, loaded))} events`;
  } else {
    summary = `Showing ${numberFormat.format(loaded)} ${loaded === 1 ? "event" : "events"}`;
  }
  if (serverSearch) summary += ` · search covers the ${numberFormat.format(SEARCH_LIMIT)} most recent events`;

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
            disabled={audit.loading || visible.length === 0}
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
          <div data-testid="audit-error">
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
            />
          </div>
        ) : visible.length === 0 && !canLoadMore ? (
          <div data-testid="audit-empty">
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
            />
          </div>
        ) : (
          <>
            {visible.length > 0 ? (
              <AuditEventList events={visible} actorFor={actorFor} now={now} />
            ) : (
              <p className="border-b border-line-soft px-5 py-8 text-center text-[14.5px] text-muted">
                No matching events in the loaded range. Load more to search older events.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13.5px] text-muted">
              <span aria-live="polite" data-testid="audit-count">
                {summary}
              </span>
              {canLoadMore && (
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
