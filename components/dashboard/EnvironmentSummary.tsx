import { Card, CardTitle, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { ENVIRONMENT_KEYS, type EnvironmentKey } from "./insights";

const SEGMENTS: Record<EnvironmentKey, { label: string; swatch: string }> = {
  production: { label: "Production", swatch: "bg-danger" },
  staging: { label: "Staging", swatch: "bg-warn" },
  development: { label: "Development", swatch: "bg-info" },
  unassigned: { label: "No environment", swatch: "bg-muted/40" },
};

/** Stacked bar + legend of credentials per environment. */
export function EnvironmentSummary({ totals }: { totals: Record<EnvironmentKey, number> | null }) {
  const total = totals ? ENVIRONMENT_KEYS.reduce((sum, key) => sum + totals[key], 0) : 0;

  return (
    <Card padded className="flex flex-col gap-3.5" data-testid="environment-breakdown">
      <CardTitle>Credentials by environment</CardTitle>
      {totals === null ? (
        <>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {ENVIRONMENT_KEYS.map((key) => (
              <Skeleton key={key} className="h-4" />
            ))}
          </div>
        </>
      ) : (
        <>
          <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-track">
            {total > 0 &&
              ENVIRONMENT_KEYS.filter((key) => totals[key] > 0).map((key) => (
                <span key={key} className={cn("h-full", SEGMENTS[key].swatch)} style={{ flexGrow: totals[key] }} />
              ))}
          </div>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-[14px] min-[400px]:grid-cols-2" aria-label="Credentials by environment">
            {ENVIRONMENT_KEYS.map((key) => (
              <li key={key} className="flex min-w-0 items-center gap-2 text-ink-2">
                <span aria-hidden="true" className={cn("h-2.5 w-2.5 flex-none rounded-[3px]", SEGMENTS[key].swatch)} />
                <span className="truncate">{SEGMENTS[key].label}</span>
                <span className="ml-auto tabular-nums text-muted">{totals[key].toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
