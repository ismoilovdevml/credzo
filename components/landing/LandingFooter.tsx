import { Github } from "lucide-react";
import { GITHUB_URL } from "./links";

const linkClass = "rounded-md text-muted underline-offset-4 transition-colors hover:text-ink hover:underline";

export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-7 text-sm text-muted sm:px-6">
        <p>
          Credzo · Open source under the{" "}
          <a href={`${GITHUB_URL}/blob/main/LICENSE`} className={linkClass} rel="noopener noreferrer" target="_blank">
            MIT licence
          </a>
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-5">
          <a href="#features" className={linkClass}>
            Features
          </a>
          <a href="#security" className={linkClass}>
            Security
          </a>
          <a
            href={GITHUB_URL}
            className={`${linkClass} inline-flex items-center gap-1.5`}
            rel="noopener noreferrer"
            target="_blank"
            data-testid="footer-github-link"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
