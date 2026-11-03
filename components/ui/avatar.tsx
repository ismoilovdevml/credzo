import { cn } from "@/lib/utils/cn";

const TONES = {
  accent: "bg-accent-soft text-accent-ink",
  info: "bg-info-soft text-info",
  violet: "bg-violet-soft text-violet",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  ink: "bg-ink text-surface",
} as const;

export type AvatarTone = keyof typeof TONES;

const AUTO_TONES: AvatarTone[] = ["accent", "info", "violet", "warn"];

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-[30px] w-[30px] text-xs",
  md: "h-[34px] w-[34px] text-[13px]",
  lg: "h-10 w-10 text-sm",
  xl: "h-12 w-12 text-base",
} as const;

/** "Dilnoza Karimova" -> "DK", "payments-api" -> "PA", "k8s" -> "K8". */
export function getInitials(name: string): string {
  const words = name.trim().split(/[\s\-_.@]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Stable tone for a name so the same person/project always gets the same colour. */
export function toneFor(name: string): AvatarTone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AUTO_TONES[Math.abs(hash) % AUTO_TONES.length];
}

export interface AvatarProps {
  /** Full name (or project name) used for initials, tone and the accessible label. */
  name: string;
  size?: keyof typeof SIZES;
  /** Defaults to a stable tone derived from `name`. */
  tone?: AvatarTone;
  /** "circle" for people, "square" for projects/organisations. */
  shape?: "circle" | "square";
  /** Hide from assistive tech when the name is already printed next to it. Default true. */
  decorative?: boolean;
  className?: string;
}

export function Avatar({ name, size = "md", tone, shape = "circle", decorative = true, className }: AvatarProps) {
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex flex-none select-none items-center justify-center font-bold",
        shape === "circle" ? "rounded-full" : size === "xl" || size === "lg" ? "rounded-[10px]" : "rounded-[7px]",
        SIZES[size],
        TONES[tone ?? toneFor(name)],
        className
      )}
    >
      {getInitials(name)}
    </span>
  );
}
