import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Minimum table width before the card scrolls horizontally (e.g. "min-w-[760px]"). */
  minWidthClass?: string;
  /** Classes for the bordered, scrollable wrapper. */
  wrapperClassName?: string;
}

/** Card-wrapped table that scrolls horizontally on narrow screens. Give it a caption or aria-label. */
export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, wrapperClassName, minWidthClass = "min-w-[720px]", ...props }, ref) => (
    <div className={cn("overflow-x-auto rounded-2xl border border-line bg-surface", wrapperClassName)}>
      <table ref={ref} className={cn("w-full border-collapse text-[14px]", minWidthClass, className)} {...props} />
    </div>
  )
);
Table.displayName = "Table";

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("text-left", className)} {...props} />
);
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&>tr:last-child>td]:border-b-0", className)} {...props} />
);
TableBody.displayName = "TableBody";

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("transition-colors [tbody>&]:hover:bg-surface-2", className)} {...props} />
  )
);
TableRow.displayName = "TableRow";

/** Column header cell. First/last columns get 20px side padding automatically. */
export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, scope = "col", ...props }, ref) => (
    <th
      ref={ref}
      scope={scope}
      className={cn(
        "whitespace-nowrap border-b border-line px-3 py-3.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted first:pl-5 last:pr-5",
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = "TableHead";

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("border-b border-line-soft px-3 py-3.5 align-middle first:pl-5 last:pr-5", className)} {...props} />
  )
);
TableCell.displayName = "TableCell";
