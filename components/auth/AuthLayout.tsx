import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Logo } from "@/components/ui";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

export interface AuthLayoutProps {
  /** Headline on the brand panel. */
  headline: string;
  /** Supporting sentence under the headline. */
  blurb: string;
  /** Short product points with a check mark each. */
  points: string[];
  children: ReactNode;
}

/**
 * Split layout for the public auth pages: a dark brand panel on the left and
 * the form on the right. Below `lg` the panel is replaced by a compact header
 * so the form stays above the fold on phones.
 */
export function AuthLayout({ headline, blurb, points, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      {/* `.dark` scopes the dark token set to the panel so it stays dark in both themes. */}
      <aside className="dark hidden min-w-0 flex-1 flex-col justify-between gap-10 bg-surface p-12 text-ink lg:flex">
        <Logo href="/" size="md" />
        <div className="flex max-w-[460px] flex-col gap-5">
          <p className="text-[40px] font-extrabold leading-[1.12] tracking-[-0.03em]">{headline}</p>
          <p className="text-[17px] leading-relaxed text-muted">{blurb}</p>
          <ul className="mt-2 flex flex-col gap-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-[15px] text-ink-2">
                <Check className="h-[18px] w-[18px] flex-none text-accent-ink" strokeWidth={2.4} aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[13px] text-muted">Self-hosted · your data stays on your servers</p>
      </aside>

      <main id="main" className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-6 lg:justify-end">
          <Logo href="/" size="sm" className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 pt-6 sm:px-6 lg:pb-16">{children}</div>
      </main>
    </div>
  );
}
