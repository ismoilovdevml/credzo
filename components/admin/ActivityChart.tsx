"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardTitle, EmptyState } from "@/components/ui";
import type { AdminStats, StatsRange } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { RANGE_SHORT, bucketLabel, bucketTitle, pluralize } from "./format";

interface ActivityChartProps {
  activity: AdminStats["activity"];
  range: StatsRange;
}

/** Rounds the y-axis maximum up so the top and middle gridlines land on whole, readable numbers. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  if (value < 10) return Math.ceil(value / 2) * 2;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Bar chart of audit events per hour (24 h) or per day (7/30 days). Hover, focus + arrow keys, or the table fallback. */
export function ActivityChart({ activity, range }: ActivityChartProps) {
  const { granularity, series } = activity;
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const hintId = useId();

  const total = series.reduce((sum, point) => sum + point.count, 0);
  const max = niceMax(Math.max(0, ...series.map((point) => point.count)));
  const ticks = [max, max / 2, 0];
  const count = series.length;
  const labelEvery = count <= 8 ? 1 : Math.ceil(count / 6);
  const showValues = count <= 8;
  const unit = granularity === "hour" ? "hour" : "day";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    const current = active ?? count - 1;
    const next: Record<string, number> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(count - 1, current + 1),
      Home: 0,
      End: count - 1,
    };
    if (event.key in next) {
      event.preventDefault();
      setActive(next[event.key]);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  const activePoint = active === null ? null : series[active];
  const activeText = activePoint
    ? `${bucketTitle(activePoint.bucket, granularity)}: ${pluralize(activePoint.count, "event")}`
    : "";

  return (
    <Card padded className="flex flex-col gap-4" data-testid="activity-chart">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <CardTitle id={titleId} className="text-base">
          Activity per {unit}
        </CardTitle>
        <span className="text-[13px] text-muted">
          {pluralize(total, "event")} in {RANGE_SHORT[range]}
        </span>
      </div>

      {total === 0 ? (
        <EmptyState bare icon={<BarChart3 />} title="No activity in this period" className="py-10" />
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <div aria-hidden="true" className="relative h-52 w-9 flex-none text-right text-[11.5px] tabular-nums text-muted">
              {ticks.map((tick, index) => (
                <span
                  key={tick}
                  className="absolute right-0 -translate-y-1/2 leading-none"
                  style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
                >
                  {tick.toLocaleString()}
                </span>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div
                role="group"
                tabIndex={0}
                aria-labelledby={titleId}
                aria-describedby={hintId}
                onKeyDown={onKeyDown}
                onFocus={() => setActive((current) => current ?? count - 1)}
                onBlur={() => setActive(null)}
                onMouseLeave={() => setActive(null)}
                className="relative h-52 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {ticks.map((tick, index) => (
                  <span
                    key={tick}
                    aria-hidden="true"
                    className={cn("absolute inset-x-0 h-px", index === ticks.length - 1 ? "bg-line" : "bg-line-soft")}
                    style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
                  />
                ))}

                <div aria-hidden="true" className={cn("absolute inset-0 flex items-end", count > 8 ? "gap-[2px] sm:gap-1" : "gap-2 sm:gap-3.5")}>
                  {series.map((point, index) => {
                    const height = (point.count / max) * 100;
                    const tone =
                      active === index
                        ? "bg-accent"
                        : active !== null
                          ? "bg-accent/25"
                          : index === count - 1
                            ? "bg-accent"
                            : "bg-accent/40";
                    return (
                      <div
                        key={point.bucket}
                        onMouseEnter={() => setActive(index)}
                        className="relative h-full min-w-0 flex-1"
                      >
                        {showValues && point.count > 0 && (
                          <span
                            className="absolute inset-x-0 text-center text-[11.5px] leading-none tabular-nums text-muted"
                            style={{ bottom: `calc(${height}% + 6px)` }}
                          >
                            {point.count.toLocaleString()}
                          </span>
                        )}
                        <span
                          className={cn(
                            "absolute bottom-0 left-1/2 w-full max-w-[44px] -translate-x-1/2 rounded-t-[4px] transition-colors",
                            tone
                          )}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {activePoint && active !== null && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px] shadow-pop",
                      active < count / 4 ? "translate-x-0" : active > (count * 3) / 4 ? "-translate-x-full" : "-translate-x-1/2"
                    )}
                    style={{ left: `${((active + 0.5) / count) * 100}%` }}
                  >
                    <span className="block text-muted">{bucketTitle(activePoint.bucket, granularity)}</span>
                    <span className="font-semibold tabular-nums text-ink">{pluralize(activePoint.count, "event")}</span>
                  </div>
                )}
              </div>

              <div aria-hidden="true" className={cn("flex", count > 8 ? "gap-[2px] sm:gap-1" : "gap-2 sm:gap-3.5")}>
                {series.map((point, index) => (
                  <span key={point.bucket} className="relative flex min-w-0 flex-1 justify-center">
                    {index % labelEvery === 0 && (
                      <span className="whitespace-nowrap text-[11.5px] text-muted">
                        {bucketLabel(point.bucket, granularity, range)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p id={hintId} className="sr-only">
            Use the left and right arrow keys to read each {unit}. A table with every value follows.
          </p>
          <p aria-live="polite" className="sr-only">
            {activeText}
          </p>

          <table className="sr-only">
            <caption>Events per {unit}, last {RANGE_SHORT[range]}</caption>
            <thead>
              <tr>
                <th scope="col">{granularity === "hour" ? "Hour" : "Day"}</th>
                <th scope="col">Events</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.bucket}>
                  <th scope="row">{bucketTitle(point.bucket, granularity)}</th>
                  <td>{point.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}
