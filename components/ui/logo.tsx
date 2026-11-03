import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const SIZES = {
  sm: { tile: "h-7 w-7 rounded-[8px]", glyph: 15, text: "text-[17px]" },
  md: { tile: "h-8 w-8 rounded-[9px]", glyph: 17, text: "text-[19px]" },
  lg: { tile: "h-10 w-10 rounded-[11px]", glyph: 21, text: "text-[23px]" },
} as const;

export interface LogoProps {
  /** Wrap in a link (e.g. "/dashboard"). */
  href?: string;
  size?: keyof typeof SIZES;
  /** Show only the lock tile. */
  iconOnly?: boolean;
  className?: string;
}

/** Credzo mark: accent tile with a lock glyph, plus the wordmark. */
export function Logo({ href, size = "md", iconOnly, className }: LogoProps) {
  const s = SIZES[size];
  const content = (
    <>
      <span className={cn("flex flex-none items-center justify-center bg-accent text-on-accent", s.tile)}>
        <svg
          width={s.glyph}
          height={s.glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      {iconOnly ? <span className="sr-only">Credzo</span> : <span>Credzo</span>}
    </>
  );
  const classes = cn("inline-flex items-center gap-2.5 font-extrabold tracking-tight text-ink", s.text, className);

  if (href) {
    return (
      <Link href={href} className={cn(classes, "rounded-lg")}>
        {content}
      </Link>
    );
  }
  return <span className={classes}>{content}</span>;
}
