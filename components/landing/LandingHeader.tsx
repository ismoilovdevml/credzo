import Link from "next/link";
import { Button, Logo } from "@/components/ui";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { MobileNav } from "./MobileNav";
import { SECTION_LINKS } from "./links";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:h-[68px] sm:px-6">
        <Logo href="/" className="flex-none" />

        <nav aria-label="Sections" className="hidden flex-1 items-center gap-6 lg:flex" data-testid="landing-nav">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md text-[15px] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden px-[18px] text-[15px] sm:inline-flex">
            <Link href="/login" data-testid="landing-signin-link">
              Sign in
            </Link>
          </Button>
          <Button asChild className="hidden px-[18px] text-[15px] sm:inline-flex">
            <Link href="/signup" data-testid="landing-get-started-link">
              Get started
            </Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
