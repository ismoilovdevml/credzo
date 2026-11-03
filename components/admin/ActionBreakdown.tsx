import { ListChecks } from "lucide-react";
import { Card, CardTitle, EmptyState } from "@/components/ui";
import type { AdminStats } from "@/lib/types";
import { actionLabel } from "./format";

const MAX_ROWS = 6;

interface Row {
  key: string;
  label: string;
  count: number;
}

/** Events grouped by audit action; actions with the same label merge, and the tail folds into "Other". */
function toRows(breakdown: AdminStats["actionBreakdown"]): Row[] {
  const merged = new Map<string, number>();
  for (const { action, count } of breakdown) {
    const label = actionLabel(action);
    merged.set(label, (merged.get(label) ?? 0) + count);
  }
  const rows = [...merged]
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count);
  if (rows.length <= MAX_ROWS) return rows;

  const tail = rows.slice(MAX_ROWS - 1);
  return [
    ...rows.slice(0, MAX_ROWS - 1),
    {
      key: "__other",
      label: `Other (${tail.length} actions)`,
      count: tail.reduce((sum, row) => sum + row.count, 0),
    },
  ];
}

export function ActionBreakdown({ breakdown }: { breakdown: AdminStats["actionBreakdown"] }) {
  const rows = toRows(breakdown);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card padded className="flex flex-col gap-4" data-testid="action-breakdown">
      <CardTitle className="text-base">Action breakdown</CardTitle>
      {rows.length === 0 ? (
        <EmptyState bare icon={<ListChecks />} title="No events in this period" className="py-10" />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate text-ink-2" title={row.label}>
                  {row.label}
                </span>
                <span className="flex-none font-semibold tabular-nums text-ink">
                  {row.count.toLocaleString()}
                  <span className="sr-only">
                    {row.count === 1 ? " event" : " events"}, {Math.round((row.count / total) * 100)}% of all events
                  </span>
                </span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
