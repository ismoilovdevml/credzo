import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons on the right; they wrap under the title on narrow screens. */
  actions?: ReactNode;
  /** Back link above the title, e.g. `{ href: "/dashboard/projects", label: "Projects" }`. */
  back?: { href: string; label: string };
  /** Element before the title (e.g. a project Avatar). */
  leading?: ReactNode;
  /** Extra row under the description (badges, meta). */
  meta?: ReactNode;
  className?: string;
}

/** Page title block. Renders the page's single <h1>. */
export function PageHeader({ title, description, actions, back, leading, meta, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {back && (
        <Link
          href={back.href}
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-[13.5px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3.5">
          {leading && <div className="flex-none">{leading}</div>}
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[28px]">
              {title}
            </h1>
            {description && <p className="text-[15px] leading-relaxed text-muted">{description}</p>}
            {meta && <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
