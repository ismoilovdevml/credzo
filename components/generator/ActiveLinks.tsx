"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Lock } from "lucide-react";
import type { ShareStatus, ShareSummary } from "@/lib/shares";
import { Badge, Button, Skeleton } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { notify } from "@/components/Toast";
import { cn } from "@/lib/utils/cn";
import { ApiError, apiRequest, errorMessage } from "./api";
import { formatAgo, formatDateTime, formatTimeLeft, pluralize, useNow } from "./format";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; shares: ShareSummary[] };

const STATUS_DOT: Record<ShareStatus, string> = {
  active: "bg-accent",
  opened: "bg-muted",
  expired: "bg-line-strong",
  revoked: "bg-danger",
};

function statusText(share: ShareSummary, now: number): string {
  switch (share.status) {
    case "active":
      return share.views > 0
        ? `${share.views}/${share.maxViews} viewed · ${formatTimeLeft(share.expiresAt, now)}`
        : formatTimeLeft(share.expiresAt, now);
    case "opened":
      return share.lastOpenedAt ? `Opened ${formatAgo(share.lastOpenedAt, now)}` : "Opened";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
  }
}

export interface ActiveLinksProps {
  /** Bump to reload the list (e.g. after creating a link). */
  reloadKey: number;
}

/** The current user's one-time links with status and revoke. */
export function ActiveLinks({ reloadKey }: ActiveLinksProps) {
  const now = useNow();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [revoking, setRevoking] = useState<ShareSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<ShareSummary[]>("/api/shares")
      .then((shares) => {
        if (!cancelled) setState({ status: "ready", shares });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: errorMessage(error, "Couldn't load your links.") });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, attempt]);

  const revoke = async (share: ShareSummary) => {
    try {
      const updated = await apiRequest<ShareSummary>(`/api/shares/${encodeURIComponent(share.id)}`, { method: "DELETE" });
      setState((current) =>
        current.status === "ready"
          ? { status: "ready", shares: current.shares.map((item) => (item.id === updated.id ? updated : item)) }
          : current
      );
      notify.success("Link revoked. The encrypted secret was deleted.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      notify.error(errorMessage(error, "Couldn't revoke the link."));
    }
  };

  const shares = state.status === "ready" ? state.shares : [];
  const activeCount = shares.filter((share) => share.status === "active").length;

  return (
    <section aria-labelledby="active-links-heading" className="flex flex-col gap-2 border-t border-line-soft pt-4">
      <div className="flex items-center gap-2">
        <h3 id="active-links-heading" className="text-[13.5px] font-semibold text-ink-2">
          Your active links
        </h3>
        {state.status === "ready" && activeCount > 0 && (
          <Badge tone="accent" size="sm">
            {activeCount}
          </Badge>
        )}
      </div>

      {state.status === "loading" && (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading links">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-9 w-full" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-[14px] text-danger">
          <AlertCircle className="h-4 w-4 flex-none" aria-hidden="true" />
          <span className="min-w-0 flex-1">{state.message}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {state.status === "ready" && shares.length === 0 && (
        <p className="py-2 text-[14px] text-muted">No links yet. Links you create appear here until a week after they expire.</p>
      )}

      {shares.length > 0 && (
        <ul data-testid="active-links" className="-mx-1 flex max-h-[22rem] flex-col overflow-y-auto px-1">
          {shares.map((share) => {
            const active = share.status === "active";
            return (
              <li
                key={share.id}
                data-testid="active-link-row"
                data-status={share.status}
                className="flex min-h-[44px] items-center gap-2.5 py-1 text-[14px]"
              >
                <span aria-hidden="true" className={cn("h-2 w-2 flex-none rounded-full", STATUS_DOT[share.status])} />
                <span className={cn("flex min-w-0 flex-1 items-center gap-1.5", !active && "text-muted")}>
                  <span className="truncate">{share.label ?? "Untitled link"}</span>
                  {share.requiresPassphrase && (
                    <Lock className="h-3.5 w-3.5 flex-none text-muted" aria-label="Passphrase required" role="img" />
                  )}
                </span>
                <span
                  className="flex-none text-right text-[13px] text-muted"
                  title={`${pluralize(share.maxViews, "view")} max · expires ${formatDateTime(share.expiresAt)}`}
                >
                  {statusText(share, now)}
                </span>
                {active && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 flex-none px-2.5 text-danger hover:bg-danger-soft hover:text-danger"
                    onClick={() => setRevoking(share)}
                    aria-label={`Revoke ${share.label ?? "untitled link"}`}
                    data-testid="revoke-link"
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => (revoking ? revoke(revoking) : undefined)}
        title="Revoke this link?"
        message="Anyone holding the link will no longer be able to open it. The encrypted secret is deleted from the server right away."
        confirmText="Revoke link"
        variant="danger"
      />
    </section>
  );
}
