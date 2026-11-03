import Link from "next/link";
import { ChevronRight, FolderPlus, KeyRound, Users, type LucideIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { rowLinkClass } from "./section";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const ACTIONS: QuickAction[] = [
  {
    id: "new-project",
    label: "New project",
    description: "Group credentials for an app or service",
    href: "/dashboard/projects/new",
    icon: FolderPlus,
  },
  {
    id: "generator",
    label: "Generator & share",
    description: "Create a strong secret or a one-time link",
    href: "/dashboard/generator",
    icon: KeyRound,
  },
];

const MEMBERS_ACTION: QuickAction = {
  id: "members",
  label: "Members",
  description: "Invite people and manage roles",
  href: "/dashboard/members",
  icon: Users,
};

export function QuickActions({ showMembers }: { showMembers: boolean }) {
  const actions = showMembers ? [...ACTIONS, MEMBERS_ACTION] : ACTIONS;
  return (
    <Card className="overflow-hidden" data-testid="quick-actions">
      <CardHeader title="Quick actions" />
      <ul className="flex flex-col">
        {actions.map(({ id, label, description, href, icon: Icon }) => (
          <li key={id} className="border-b border-line-soft last:border-b-0">
            <Link
              href={href}
              data-testid={`quick-action-${id}`}
              className={cn("group flex items-center gap-3 px-5 py-3", rowLinkClass)}
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent-soft text-accent-ink"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-semibold text-ink">{label}</span>
                <span className="truncate text-[13px] text-muted">{description}</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
