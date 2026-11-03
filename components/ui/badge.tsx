import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const TONES = {
  neutral: "bg-ink/[0.06] text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  violet: "bg-violet-soft text-violet",
} as const;

export type BadgeTone = keyof typeof TONES;
export type Environment = "production" | "staging" | "development";

const ENV_TONE: Record<Environment, BadgeTone> = {
  production: "danger",
  staging: "warn",
  development: "info",
};

const ENV_SHORT: Record<Environment, string> = {
  production: "prod",
  staging: "staging",
  development: "dev",
};

/** Tone for an environment string; unknown values fall back to neutral. */
export function envTone(env: string): BadgeTone {
  return ENV_TONE[env as Environment] ?? "neutral";
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Leading status dot in the current colour. */
  dot?: boolean;
  size?: "sm" | "md";
}

/** Pill label. `tone` picks the colour pair; see `EnvBadge` for environments. */
export function Badge({ tone = "neutral", dot, size = "md", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none",
        size === "sm" ? "px-2 py-[3px] text-[11.5px]" : "px-2.5 py-1 text-xs",
        TONES[tone],
        className
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-current" />}
      {children}
    </span>
  );
}

export interface EnvBadgeProps extends Omit<BadgeProps, "tone" | "children"> {
  env: string;
  /** "prod" / "dev" instead of the full word. */
  short?: boolean;
}

/** Environment pill: production = danger, staging = warn, development = info. */
export function EnvBadge({ env, short, ...props }: EnvBadgeProps) {
  const label = short ? (ENV_SHORT[env as Environment] ?? env) : env;
  return (
    <Badge tone={envTone(env)} {...props}>
      {label}
    </Badge>
  );
}
