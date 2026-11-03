"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { notify } from "@/components/Toast";
import { cn } from "@/lib/utils/cn";
import { useSession } from "./SessionProvider";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const roleLabel = (role: string | null) => (role ? (ROLE_LABELS[role] ?? role) : "Member");

const blockClass =
  "flex min-h-[48px] w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface-2 p-2.5 text-left";

async function activateOrganization(organizationId: string): Promise<void> {
  const response = await fetch("/api/auth/active-organization", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId }),
  });
  if (response.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Couldn't switch organisation (${response.status})`;
    throw new Error(message);
  }
}

/**
 * Current organisation block at the top of the sidebar. With more than one
 * membership it becomes a menu that switches the active organisation.
 */
export function OrgSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { organization, organizations, role, isPlatformAdmin, refresh, refreshProjectCount } = useSession();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const name = organization?.name ?? "No organisation";
  const subtitle = isPlatformAdmin && !role ? "Platform admin" : `Organisation · ${roleLabel(role)}`;

  const summary = (
    <>
      <Avatar name={organization?.name || "Credzo"} tone="ink" shape="square" size="sm" className="h-7 w-7 text-xs" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold text-ink">{name}</span>
        <span className="truncate text-[12px] text-muted">{subtitle}</span>
      </span>
    </>
  );

  if (organizations.length < 2) {
    return (
      <div data-testid="org-switcher" className={blockClass}>
        {summary}
      </div>
    );
  }

  const select = async (organizationId: string) => {
    if (organizationId === organization?.id || switchingTo) return;
    setSwitchingTo(organizationId);
    try {
      await activateOrganization(organizationId);
      await refresh();
      void refreshProjectCount();
      router.refresh();
      router.push("/dashboard");
      onNavigate?.();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Couldn't switch organisation");
    } finally {
      setSwitchingTo(null);
    }
  };

  return (
    <DropdownMenu
      align="start"
      label="Switch organisation"
      className="w-[min(280px,calc(100vw-16px))]"
      trigger={
        <button
          type="button"
          data-testid="org-switcher"
          aria-label={`Organisation: ${name}. Switch organisation`}
          aria-busy={switchingTo ? true : undefined}
          disabled={switchingTo !== null}
          className={cn(
            blockClass,
            "transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-wait"
          )}
        >
          {summary}
          {switchingTo ? (
            <Spinner className="h-4 w-4 flex-none text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 flex-none text-muted" aria-hidden="true" />
          )}
        </button>
      }
    >
      <DropdownMenuLabel>Switch organisation</DropdownMenuLabel>
      {organizations.map((org) => {
        const current = org.id === organization?.id;
        return (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => void select(org.id)}
            icon={<Avatar name={org.name} shape="square" size="xs" />}
            trailing={
              <span className="flex items-center gap-2">
                {roleLabel(org.role)}
                <Check
                  className={cn("h-4 w-4 text-accent-ink", !current && "invisible")}
                  aria-hidden="true"
                />
              </span>
            }
          >
            <span data-testid="org-option" data-organization-id={org.id} data-current={current || undefined}>
              {org.name}
              {current && <span className="sr-only"> (current)</span>}
            </span>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenu>
  );
}
