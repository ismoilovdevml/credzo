"use client";

import { forwardRef, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { IconButton, Input, type InputProps } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { scorePassword, type StrengthScore } from "./format";

/** Password input with a show/hide toggle. Forwards every prop (including Field's id/aria wiring) to the input. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "trailing">>(function PasswordInput(
  props,
  ref
) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      trailing={
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          size="sm"
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </IconButton>
      }
      {...props}
    />
  );
});

const STRENGTH_TONES: Record<StrengthScore, { bar: string; text: string }> = {
  0: { bar: "bg-line-strong", text: "text-muted" },
  1: { bar: "bg-danger", text: "text-danger" },
  2: { bar: "bg-warn", text: "text-warn" },
  3: { bar: "bg-success", text: "text-success" },
  4: { bar: "bg-success", text: "text-success" },
};

/** Four-segment strength bar for a new password. Renders nothing while the field is empty. */
export function StrengthMeter({ password, id }: { password: string; id?: string }) {
  if (!password) return null;
  const { score, label } = scorePassword(password);
  const tone = STRENGTH_TONES[score];
  return (
    <div id={id} className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn("h-1.5 flex-1 rounded-full transition-colors", segment <= score ? tone.bar : "bg-line-strong")}
          />
        ))}
      </div>
      <span className={cn("w-[84px] flex-none text-right text-[13px] font-semibold", tone.text)}>
        <span className="sr-only">Password strength: </span>
        {label}
      </span>
    </div>
  );
}

/** Title/description on the left, actions on the right; wraps on narrow screens. */
export function SettingRow({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 border-b border-line-soft py-4 last:border-b-0", className)}>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">{title}</div>
        {description && <div className="text-[14px] text-muted">{description}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
