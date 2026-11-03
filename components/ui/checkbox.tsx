"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

/** Styled native checkbox. Use `checked` + `onChange` (or `defaultChecked`) like a normal input. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const descriptionId = description ? `${inputId}-desc` : undefined;

    const box = (
      <span className="relative mt-px inline-flex h-[18px] w-[18px] flex-none">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-describedby={descriptionId}
          className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-surface transition-colors checked:border-accent checked:bg-accent hover:border-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-55"
          {...props}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-on-accent opacity-0 peer-checked:opacity-100"
        />
      </span>
    );

    if (!label) return <span className={className}>{box}</span>;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-[28px] items-start gap-2.5 text-[14px] text-ink-2",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          className
        )}
      >
        {box}
        <span className="flex min-w-0 flex-col gap-0.5 leading-snug">
          <span>{label}</span>
          {description && (
            <span id={descriptionId} className="text-[13px] text-muted">
              {description}
            </span>
          )}
        </span>
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label. When omitted, pass `aria-label`. */
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/** On/off toggle (role="switch"). Space/Enter toggle it like a button. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
}: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const labelId = label ? `${switchId}-label` : undefined;
  const descriptionId = description ? `${switchId}-desc` : undefined;

  const control = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 flex-none items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-55",
        checked ? "bg-accent" : "bg-line-strong"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-[18px] w-[18px] rounded-full bg-white shadow-pill transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );

  if (!label) return <span className={className}>{control}</span>;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <label id={labelId} htmlFor={switchId} className="cursor-pointer text-[14.5px] font-semibold text-ink">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-[13.5px] text-muted">
            {description}
          </p>
        )}
      </div>
      {control}
    </div>
  );
}
