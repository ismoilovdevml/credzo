"use client";

import { useId, type LabelHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Appends a muted "(optional)" marker. */
  optional?: boolean;
  /** Appends a required marker (visual only; set `required` on the control too). */
  required?: boolean;
}

export function Label({ className, optional, required, children, ...props }: LabelProps) {
  return (
    <label className={cn("text-sm font-semibold text-ink-2", className)} {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      )}
      {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
    </label>
  );
}

export interface FieldProps {
  label: ReactNode;
  /** Exactly one form control (Input, Select, Textarea…). It receives id, aria-describedby and aria-invalid. */
  children: ReactElement;
  hint?: ReactNode;
  error?: ReactNode;
  /** Explicit control id; generated when omitted. Set it here, not on the child. */
  id?: string;
  optional?: boolean;
  required?: boolean;
  /** Extra element on the label row, right-aligned (e.g. a "Generate" link). */
  labelAction?: ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired together for screen readers. */
export function Field({ label, children, hint, error, id, optional, required, labelAction, className }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={controlId} optional={optional} required={required}>
          {label}
        </Label>
        {labelAction}
      </div>
      <Slot id={controlId} aria-describedby={describedBy} aria-invalid={error ? true : undefined} aria-required={required || undefined}>
        {children}
      </Slot>
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-[13px] font-medium text-danger">
          <AlertCircle className="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
