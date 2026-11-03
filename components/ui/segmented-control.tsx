"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { DataAttributes } from "./types";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional muted count shown after the label. */
  count?: number;
  /** data-testid for this option's button. */
  testId?: string;
}

export interface SegmentedControlProps<T extends string> extends DataAttributes {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Accessible name for the group, e.g. "Filter by environment". */
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
}

/** Pill toggle group (filters, periods). Each option is a button with aria-pressed. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  "aria-label": ariaLabel,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-track p-1", className)}
      {...rest}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm",
              active
                ? "bg-surface font-semibold text-ink shadow-pill dark:bg-line"
                : "font-medium text-ink-2 hover:text-ink"
            )}
          >
            {option.label}
            {option.count !== undefined && <span className="font-medium text-muted">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
