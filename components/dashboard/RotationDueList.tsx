import Link from "next/link";
import { AlertTriangle, CalendarCheck, Clock } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { DUE_SOON_DAYS, credentialHref, pluralize, rotationStatus, type RotationItem } from "./insights";
import { RowsSkeleton, SectionMessage } from "./section";

const MAX_ITEMS = 6;

export interface RotationDueListProps {
  /** Overdue or due-soon credentials, soonest first; null while loading. */
  due: RotationItem[] | null;
  /** Number of credentials with a rotation policy (for the empty state). */
  scheduledCount: number;
}

/** "Due for rotation": credentials whose rotation policy is overdue or due within DUE_SOON_DAYS. */
export function RotationDueList({ due, scheduledCount }: RotationDueListProps) {
  const overdue = due?.filter((item) => item.overdue).length ?? 0;

  return (
    <Card className="overflow-hidden" data-testid="rotation-due-list">
      <CardHeader
        title="Due for rotation"
        actions={
          due && due.length > 0 ? (
            <Badge tone={overdue > 0 ? "danger" : "warn"}>
              {due.length}
              <span className="sr-only"> due</span>
            </Badge>
          ) : undefined
        }
      />
      {due === null ? (
        <RowsSkeleton rows={3} avatar="h-8 w-8 rounded-lg" />
      ) : due.length === 0 ? (
        <SectionMessage icon={<CalendarCheck />} title={scheduledCount > 0 ? "Everything is on schedule" : "No rotation policies yet"}>
          {scheduledCount > 0
            ? `${pluralize(scheduledCount, "credential")} on a rotation schedule, none due in the next ${DUE_SOON_DAYS} days.`
            : "Set a rotation interval on a credential to get reminded here when it is due."}
        </SectionMessage>
      ) : (
        <>
          <ul className="flex flex-col">
            {due.slice(0, MAX_ITEMS).map((item) => {
              const { credential } = item;
              const Icon = item.overdue ? AlertTriangle : Clock;
              return (
                <li
                  key={credential.id}
                  data-testid="rotation-due-item"
                  data-credential-id={credential.id}
                  data-overdue={item.overdue || undefined}
                  className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-8 w-8 flex-none items-center justify-center rounded-lg",
                      item.overdue ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-mono text-[13.5px] font-medium text-ink">{credential.name}</span>
                    <span className="truncate text-[13px] text-muted">
                      <span className={cn("font-semibold", item.overdue ? "text-danger" : "text-warn")}>
                        {rotationStatus(item)}
                      </span>{" "}
                      · {credential.projectName}
                    </span>
                  </span>
                  <Link
                    href={credentialHref(credential)}
                    aria-label={`${item.overdue ? "Rotate" : "Open"} ${credential.name}`}
                    className="flex-none rounded-md px-1 text-[13.5px] font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {item.overdue ? "Rotate" : "Open"}
                  </Link>
                </li>
              );
            })}
          </ul>
          {due.length > MAX_ITEMS && (
            <p className="border-t border-line-soft px-5 py-3 text-[13px] text-muted">
              +{due.length - MAX_ITEMS} more due in the next {DUE_SOON_DAYS} days
            </p>
          )}
        </>
      )}
    </Card>
  );
}
