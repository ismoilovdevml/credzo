"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FolderClosed, House, KeyRound, Shield, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils/cn";
import { OrgSwitcher } from "./OrgSwitcher";
import { useSession } from "./SessionProvider";
import { UserMenu } from "./UserMenu";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only highlight on an exact match (for the Overview root). */
  exact?: boolean;
  count?: number | null;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
  heading,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  heading?: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-0.5">
      {heading && (
        <span className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">{heading}</span>
      )}
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[42px] items-center gap-[11px] rounded-[9px] px-2.5 text-[14.5px] transition-colors",
              active
                ? "bg-accent-soft font-semibold text-accent-ink"
                : "font-medium text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
            )}
          >
            <Icon className="h-[18px] w-[18px] flex-none" strokeWidth={1.8} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count !== undefined && item.count !== null && (
              <span className="text-xs font-medium tabular-nums text-muted">{item.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sidebar body, shared by the desktop rail and the mobile drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, isAdmin, projectCount } = useSession();

  const mainItems: NavItem[] = [
    { label: "Overview", href: "/dashboard", icon: House, exact: true },
    { label: "Projects", href: "/dashboard/projects", icon: FolderClosed, count: projectCount },
    { label: "Generator & share", href: "/dashboard/generator", icon: KeyRound },
    { label: "Settings", href: "/dashboard/settings", icon: SlidersHorizontal },
  ];
  const adminItems: NavItem[] = [
    { label: "Admin overview", href: "/dashboard/admin", icon: Shield },
    { label: "Members", href: "/dashboard/members", icon: Users },
    { label: "Audit log", href: "/dashboard/audit", icon: Activity },
  ];

  return (
    <div className="flex h-full flex-col gap-[18px] px-3.5 py-5">
      <Logo href="/dashboard" className="px-1.5" />

      <OrgSwitcher onNavigate={onNavigate} />

      <NavGroup label="Main" items={mainItems} pathname={pathname} onNavigate={onNavigate} />
      {isAdmin && (
        <NavGroup label="Administration" heading="Admin" items={adminItems} pathname={pathname} onNavigate={onNavigate} />
      )}

      {user && (
        <div className="mt-auto border-t border-line-soft pt-2">
          <UserMenu user={user} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
}
