import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const sizes = {
  sm: "h-9 text-[13.5px]",
  md: "h-11",
  lg: "h-12 text-[15px]",
} as const;

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Control height. Default "md" (44px). */
  inputSize?: keyof typeof sizes;
  /** Render the value in JetBrains Mono (hosts, keys, secrets). */
  mono?: boolean;
  /** Icon or element pinned to the left inside the field (e.g. a search glyph). */
  leading?: ReactNode;
  /** Element pinned to the right inside the field (e.g. a reveal toggle). */
  trailing?: ReactNode;
  /** Marks the field invalid (sets aria-invalid). `Field` sets this automatically. */
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize = "md", mono, leading, trailing, invalid, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn(
          "field-control",
          sizes[inputSize],
          mono && "font-mono text-[14px]",
          leading && "pl-10",
          trailing && "pr-11",
          className
        )}
        {...props}
      />
    );
    if (!leading && !trailing) return input;
    return (
      <div className="relative w-full">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted [&_svg]:h-[17px] [&_svg]:w-[17px]">
            {leading}
          </span>
        )}
        {input}
        {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, mono, invalid, rows = 3, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || ariaInvalid || undefined}
      className={cn("field-control min-h-[88px] resize-y py-2.5 leading-relaxed", mono && "font-mono text-[14px]", className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  inputSize?: keyof typeof sizes;
  invalid?: boolean;
}

/** Native select styled like Input. Pass <option> children. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, inputSize = "md", invalid, children, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn("field-control cursor-pointer appearance-none pr-10", sizes[inputSize], className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </div>
  )
);
Select.displayName = "Select";
