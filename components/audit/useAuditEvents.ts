"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import type { AuditEvent } from "./audit-model";

export const PAGE_SIZE = 50;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function toEvent(raw: unknown): AuditEvent | null {
  if (!isObject(raw) || typeof raw.id !== "string" || typeof raw.timestamp !== "string") return null;
  const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);
  return {
    id: raw.id,
    organizationId: text(raw.organizationId),
    userId: typeof raw.userId === "string" ? raw.userId : "",
    action: typeof raw.action === "string" ? raw.action : "",
    resourceType: typeof raw.resourceType === "string" ? raw.resourceType : "",
    resourceId: text(raw.resourceId),
    details: isObject(raw.details) ? raw.details : undefined,
    ipAddress: text(raw.ipAddress),
    userAgent: text(raw.userAgent),
    timestamp: raw.timestamp,
  };
}

interface AuditPage {
  events: AuditEvent[];
  /** Raw rows received (before dropping malformed ones), used as the next offset. */
  received: number;
  total: number | null;
  hasMore: boolean;
}

export interface AuditQuery {
  /** Organization id, or "all" for the platform-wide log (platform admins). */
  scope: string;
  action: string;
  resourceType: string;
  userId: string;
  search: string;
  /** ISO timestamps (inclusive bounds); empty = unbounded. */
  from: string;
  to: string;
}

async function fetchAuditPage(query: AuditQuery, offset: number, signal?: AbortSignal): Promise<AuditPage> {
  const { scope, ...filters } = query;
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }

  const data = await api.get<unknown>(`/api/organizations/${encodeURIComponent(scope)}/audit?${params}`, {
    signal,
    fallbackError: "Couldn't load the audit log.",
  });
  const rawLogs = isObject(data) && Array.isArray(data.logs) ? data.logs : [];
  const events = rawLogs.map(toEvent).filter((event): event is AuditEvent => event !== null);
  const pagination = isObject(data) && isObject(data.pagination) ? data.pagination : null;
  const total = typeof pagination?.total === "number" ? pagination.total : null;

  let hasMore: boolean;
  if (typeof pagination?.hasMore === "boolean") hasMore = pagination.hasMore;
  else if (total !== null) hasMore = offset + rawLogs.length < total;
  else hasMore = rawLogs.length === PAGE_SIZE;

  return { events, received: rawLogs.length, total, hasMore };
}

interface State {
  /** Query key the data belongs to; a mismatch with the current key means "loading". */
  key: string;
  events: AuditEvent[];
  fetched: number;
  total: number | null;
  hasMore: boolean;
  error: ApiError | null;
  loadingMore: boolean;
  loadMoreError: string | null;
}

const INITIAL: State = {
  key: "",
  events: [],
  fetched: 0,
  total: null,
  hasMore: false,
  error: null,
  loadingMore: false,
  loadMoreError: null,
};

const errorFrom = (error: unknown) =>
  error instanceof ApiError ? error : new ApiError(0, "Couldn't load the audit log.");

/** Loads audit events for `query` (null = don't load) with offset pagination. Memoise `query`: a new object refetches. */
export function useAuditEvents(query: AuditQuery | null) {
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<State>(INITIAL);
  const key = query ? JSON.stringify([query, reload]) : "";
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetchAuditPage(query, 0, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setState({ ...INITIAL, key, events: page.events, fetched: page.received, total: page.total, hasMore: page.hasMore });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ ...INITIAL, key, error: errorFrom(error) });
      });
    return () => controller.abort();
  }, [query, key]);

  const current = state.key === key ? state : null;

  const loadMore = useCallback(async () => {
    if (!query || !current || !current.hasMore || current.loadingMore) return;
    const requestKey = key;
    setState((prev) => ({ ...prev, loadingMore: true, loadMoreError: null }));
    try {
      const page = await fetchAuditPage(query, current.fetched);
      if (keyRef.current !== requestKey) return;
      setState((prev) => {
        // New events shift offsets; skip rows we already have.
        const seen = new Set(prev.events.map((event) => event.id));
        return {
          ...prev,
          events: [...prev.events, ...page.events.filter((event) => !seen.has(event.id))],
          fetched: prev.fetched + page.received,
          total: page.total ?? prev.total,
          hasMore: page.hasMore,
          loadingMore: false,
        };
      });
    } catch (error) {
      if (keyRef.current !== requestKey) return;
      setState((prev) => ({ ...prev, loadingMore: false, loadMoreError: errorFrom(error).message }));
    }
  }, [query, current, key]);

  const retry = useCallback(() => setReload((value) => value + 1), []);

  return {
    loading: query !== null && current === null,
    events: current?.events ?? [],
    total: current?.total ?? null,
    hasMore: current?.hasMore ?? false,
    error: current?.error ?? null,
    loadingMore: current?.loadingMore ?? false,
    loadMoreError: current?.loadMoreError ?? null,
    loadMore,
    retry,
  };
}
