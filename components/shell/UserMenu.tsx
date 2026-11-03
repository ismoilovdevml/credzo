"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useTheme, type Theme } from "@/hooks/useTheme";
import type { SessionUser } from "./SessionProvider";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Sidebar footer: who is signed in, plus account, theme and sign-out actions. */
export function UserMenu({ user, onNavigate }: { user: SessionUser; onNavigate?: () => void }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Even if the request fails, leave the app; the server rejects the stale cookie on next use.
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <DropdownMenu
      side="top"
      align="start"
      label="Account"
      className="w-[236px]"
      trigger={
        <button
          type="button"
          disabled={signingOut}
          className="flex w-full min-w-0 items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-ink/[0.05] disabled:opacity-60"
        >
          <Avatar name={user.name} tone="violet" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] font-semibold text-ink">{user.name}</span>
            <span className="truncate text-[12px] text-muted">{user.email}</span>
          </span>
          {signingOut ? (
            <Spinner className="h-4 w-4 text-muted" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 flex-none text-muted" aria-hidden="true" />
          )}
          <span className="sr-only">Account menu</span>
        </button>
      }
    >
      <DropdownMenuItem href="/dashboard/settings" icon={<Settings />} onSelect={onNavigate}>
        Account settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Theme</DropdownMenuLabel>
      {THEMES.map(({ value, label, icon: Icon }) => (
        <DropdownMenuItem
          key={value}
          icon={<Icon />}
          onSelect={() => setTheme(value)}
          trailing={
            theme === value ? (
              <>
                <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="sr-only">(current)</span>
              </>
            ) : undefined
          }
        >
          {label}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem icon={<LogOut />} tone="danger" onSelect={signOut}>
        Sign out
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
