"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpCircle, Laptop, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { notify } from "@/components/Toast";
import type { SessionSummary } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/api-client";
import { errorMessage } from "./api";
import { formatDateTime, formatRelative, parseUserAgent, type DeviceKind } from "./format";

const DEVICE_ICONS: Record<DeviceKind, typeof Laptop> = {
  desktop: Laptop,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: HelpCircle,
};

/** Current first, then most recently active. */
function sortSessions(sessions: SessionSummary[]): SessionSummary[] {
  return [...sessions].sort(
    (a, b) => Number(b.current) - Number(a.current) || new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}

/** Active sessions with per-device sign-out and "Sign out all others". `version` bumps force a reload. */
export function SessionsList({ version }: { version: number }) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<SessionSummary[]>("/api/sessions");
      setSessions(sortSessions(data));
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error, "Couldn't load your sessions"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const signOut = async (session: SessionSummary) => {
    setRevoking(session.id);
    try {
      await api.del(`/api/sessions/${encodeURIComponent(session.id)}`);
      setSessions((current) => current?.filter((item) => item.id !== session.id) ?? null);
      notify.success(`Signed out ${parseUserAgent(session.userAgent).label}`);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't sign out that session"));
    } finally {
      setRevoking(null);
    }
  };

  const signOutOthers = async () => {
    setRevoking("others");
    try {
      const { revoked } = await api.del<{ revoked: number }>("/api/sessions");
      setSessions((current) => current?.filter((item) => item.current) ?? null);
      notify.success(revoked === 1 ? "Signed out 1 other session" : `Signed out ${revoked} other sessions`);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't sign out other sessions"));
    } finally {
      setRevoking(null);
    }
  };

  const others = sessions?.filter((session) => !session.current).length ?? 0;

  return (
    <div className="flex flex-col gap-2.5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-ink">Active sessions</h3>
        {others > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger-soft hover:text-danger"
            data-testid="sign-out-others"
            loading={revoking === "others"}
            disabled={revoking !== null && revoking !== "others"}
            onClick={signOutOthers}
          >
            Sign out all others
          </Button>
        )}
      </div>

      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-[14px]">
          <span className="flex-1 text-danger">{loadError}</span>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw />} onClick={load}>
            Retry
          </Button>
        </div>
      ) : sessions === null ? (
        <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading sessions">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sessions.map((session) => {
            const device = parseUserAgent(session.userAgent);
            const Icon = DEVICE_ICONS[device.kind];
            const lastActive = session.current ? "active now" : formatRelative(session.lastActivity);
            return (
              <li
                key={session.id}
                data-testid="session-row"
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 flex-none items-center justify-center rounded-lg",
                    session.current ? "bg-accent-soft text-accent-ink" : "bg-ink/[0.06] text-ink-2"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-[1_1_180px] flex-col">
                  <span className="flex flex-wrap items-baseline gap-x-1.5 text-[14.5px] font-semibold text-ink">
                    {device.label}
                    {session.current && <span className="text-[13px] font-semibold text-success">· This device</span>}
                  </span>
                  <span className="truncate text-[13px] text-muted">
                    {session.ip ?? "Unknown IP"} ·{" "}
                    <time dateTime={session.lastActivity} title={formatDateTime(session.lastActivity)}>
                      {lastActive}
                    </time>
                  </span>
                </span>
                {!session.current && (
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid="sign-out-session"
                    loading={revoking === session.id}
                    disabled={revoking !== null && revoking !== session.id}
                    onClick={() => signOut(session)}
                    aria-label={`Sign out ${device.label}${session.ip ? ` (${session.ip})` : ""}`}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
