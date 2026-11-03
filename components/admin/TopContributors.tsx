import { Users } from "lucide-react";
import { Avatar, Card, CardTitle, EmptyState } from "@/components/ui";
import type { AdminStats } from "@/lib/types";
import { pluralize } from "./format";

/** The five most active people in the period (failed sign-ins excluded by the API). */
export function TopContributors({ contributors }: { contributors: AdminStats["topContributors"] }) {
  return (
    <Card padded className="flex flex-col gap-3.5" data-testid="top-contributors">
      <CardTitle className="text-base">Top contributors</CardTitle>
      {contributors.length === 0 ? (
        <EmptyState bare icon={<Users />} title="No activity in this period" className="py-8" />
      ) : (
        <ol className="flex flex-col gap-3">
          {contributors.map((person) => (
            <li key={person.userId} className="flex items-center gap-2.5 text-[14px]" data-testid="top-contributor">
              <Avatar name={person.name} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-ink">{person.name}</span>
                <span className="truncate text-[12.5px] text-muted">@{person.username}</span>
              </span>
              <span className="flex-none tabular-nums text-muted">{pluralize(person.events, "event")}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
