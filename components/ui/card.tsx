import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Bordered surface. Use `padded` for a simple 20px box, or compose CardHeader / CardContent / CardFooter. */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { padded?: boolean }>(
  ({ className, padded, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("min-w-0 rounded-2xl border border-line bg-surface text-ink", padded && "p-5", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned element(s), e.g. a "View all" link or a count badge. */
  actions?: ReactNode;
}

/** Header row with a bottom divider. Pass `title` (+ `description`, `actions`) or custom children. */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, description, actions, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-5 py-4", className)}
      {...props}
    >
      {(title || description) && (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      )}
      {children}
      {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-[17px] font-bold leading-snug tracking-tight text-ink", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-[13.5px] text-muted", className)} {...props} />
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5", className)} {...props} />
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-line-soft bg-surface-2 px-5 py-3.5", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";
