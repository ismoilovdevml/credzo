"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface ScopeOptionProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  description: ReactNode;
  /** Shown instead of being selectable; explains why (e.g. org viewers). */
  disabledReason?: ReactNode;
  testId: string;
}

/** Radio card for the "Who can see it" choice. */
export function ScopeOption({ name, value, checked, onSelect, title, description, disabledReason, testId }: ScopeOptionProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const reasonId = disabledReason ? `${id}-reason` : undefined;
  const disabled = Boolean(disabledReason);

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface",
        checked ? "border-accent bg-accent-soft ring-1 ring-inset ring-accent" : "border-line",
        disabled ? "cursor-not-allowed bg-surface-2" : "cursor-pointer hover:border-line-strong"
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        aria-describedby={[descriptionId, reasonId].filter(Boolean).join(" ")}
        data-testid={testId}
        className="mt-0.5 h-[18px] w-[18px] flex-none accent-accent focus-visible:outline-none disabled:cursor-not-allowed"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <strong className={cn("text-[14.5px] font-semibold", disabled ? "text-muted" : "text-ink")}>{title}</strong>
        <span id={descriptionId} className="text-sm text-muted">
          {description}
        </span>
        {disabledReason && (
          <span id={reasonId} className="mt-1 text-[13px] font-medium text-warn">
            {disabledReason}
          </span>
        )}
      </span>
    </label>
  );
}
