import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./spinner";

const secondary = "border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:border-muted/50";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-ink",
        secondary,
        /** Alias of `secondary`, kept for existing callers. */
        outline: secondary,
        ghost: "text-ink-2 hover:bg-ink/[0.06] hover:text-ink",
        danger: "bg-danger text-surface hover:bg-danger/90",
        link: "text-accent-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-[13.5px] [&_svg]:h-4 [&_svg]:w-4",
        md: "h-11 px-4 text-[14.5px] [&_svg]:h-[17px] [&_svg]:w-[17px]",
        lg: "h-12 px-5 text-[15px] [&_svg]:h-[18px] [&_svg]:w-[18px]",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the single child element (e.g. a Next `<Link>`) with button styling. */
  asChild?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  /** Icon rendered before the label. */
  leftIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, leftIcon, disabled, children, type, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-disabled={asChild && (disabled || loading) ? true : undefined}
        aria-busy={loading || undefined}
        type={asChild ? undefined : (type ?? "button")}
        {...props}
      >
        {loading ? <Spinner className="h-4 w-4" /> : leftIcon}
        <Slottable>{children}</Slottable>
      </Comp>
    );
  }
);
Button.displayName = "Button";

const iconButtonVariants = cva(
  "inline-flex flex-none items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        ghost: "text-ink-2 hover:bg-ink/[0.06] hover:text-ink",
        secondary: "border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
        danger: "text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
        md: "h-10 w-10 [&_svg]:h-[18px] [&_svg]:w-[18px]",
        lg: "h-11 w-11 [&_svg]:h-[18px] [&_svg]:w-[18px]",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  }
);

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">,
    VariantProps<typeof iconButtonVariants> {
  /** Required accessible name; also used as the tooltip. */
  label: string;
  asChild?: boolean;
}

/** Square icon-only button. `label` is required and becomes aria-label + title. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, label, asChild = false, type, title, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        aria-label={label}
        title={title ?? label}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
IconButton.displayName = "IconButton";
