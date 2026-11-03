import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const HINT_TONES = {
  muted: "text-muted",
  accent: "text-accent-ink",
  warn: "text-warn",
  danger: "text-danger",
} as const;

export interface StatCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: ReactNode;
  value: ReactNode;
  /** Small text after the value, e.g. "/ 100". */
  suffix?: ReactNode;
  /** Line under the value, e.g. "+9 this week". */
  hint?: ReactNode;
  hintTone?: keyof typeof HINT_TONES;
  /** 0–100; renders a thin progress bar under the value. */
  progress?: number;
  icon?: ReactNode;
}

/** KPI tile: label, large number, optional hint or progress bar. Shows a skeleton when `value` is undefined. */
export function StatCard({
  label,
  value,
  suffix,
  hint,
  hintTone = "muted",
  progress,
  icon,
  className,
  ...rest
}: StatCardProps) {
  const clamped = progress === undefined ? undefined : Math.min(100, Math.max(0, progress));
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-5", className)} {...rest}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-muted">{label}</span>
        {icon && <span className="text-muted [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      </div>
      {value === undefined ? (
        <span aria-hidden="true" className="h-9 w-20 animate-pulse rounded-md bg-ink/[0.06]" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-[32px] font-extrabold leading-none tracking-tight tabular-nums text-ink">{value}</span>
          {suffix && <span className="text-[15px] text-muted">{suffix}</span>}
        </div>
      )}
      {clamped !== undefined && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clamped)}
          aria-label={typeof label === "string" ? label : undefined}
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${clamped}%` }} />
        </div>
      )}
      {hint && <span className={cn("text-[13px]", hintTone !== "muted" && "font-semibold", HINT_TONES[hintTone])}>{hint}</span>}
    </div>
  );
}
