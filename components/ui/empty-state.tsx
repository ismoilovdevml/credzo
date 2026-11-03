import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /** A lucide icon element, e.g. `<FolderOpen />`. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Primary call to action (usually a Button). */
  action?: ReactNode;
  /** Drop the dashed border when placed inside a Card. */
  bare?: boolean;
}

/** Centered placeholder for empty lists, empty search results and first-run screens. */
export function EmptyState({ icon, title, description, action, bare, className, ...rest }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        !bare && "rounded-2xl border border-dashed border-line-strong bg-surface",
        className
      )}
      {...rest}
    >
      {icon && (
        <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-ink [&_svg]:h-6 [&_svg]:w-6">
          {icon}
        </span>
      )}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-[14px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
