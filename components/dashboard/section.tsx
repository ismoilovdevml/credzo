import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/** Accent "View all"-style link used in section headers. */
export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md text-[14px] font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {children}
    </Link>
  );
}

/** Interactive list-row classes (link rows inside a section card). */
export const rowLinkClass =
  "transition-colors hover:bg-ink/[0.03] focus-visible:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50";

/** Placeholder rows while a section loads. */
export function RowsSkeleton({ rows, avatar = "h-10 w-10 rounded-[10px]" }: { rows: number; avatar?: string }) {
  return (
    <ul aria-hidden="true" className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-3.5 border-b border-line-soft px-5 py-4 last:border-b-0">
          <Skeleton className={cn("flex-none", avatar)} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Small centred message inside a section card (empty or failed sections). */
export function SectionMessage({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      )}
      <p className="text-[14.5px] font-semibold text-ink">{title}</p>
      {children && <div className="max-w-xs text-[13.5px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}
