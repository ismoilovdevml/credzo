import { AlertCircle } from "lucide-react";

/** Form-level error banner, announced to screen readers when it appears. */
export function FormError({ message, testId }: { message: string; testId: string }) {
  return (
    <div
      role="alert"
      data-testid={testId}
      className="flex animate-fade-in items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-[14px] font-medium text-danger"
    >
      <AlertCircle className="mt-px h-[17px] w-[17px] flex-none" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
