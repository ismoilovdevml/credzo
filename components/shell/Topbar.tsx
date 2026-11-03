"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "./ThemeToggle";

/** Sticky top bar: mobile menu button, project search (Ctrl/⌘+K) and theme toggle. */
export function Topbar({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/dashboard/projects?q=${encodeURIComponent(term)}` : "/dashboard/projects");
    inputRef.current?.blur();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/85 sm:px-6 lg:h-[77px] lg:px-8">
      <IconButton
        label="Open navigation"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
        onClick={onOpenMenu}
        className="-ml-2 lg:hidden"
      >
        <Menu />
      </IconButton>
      <Logo href="/dashboard" size="sm" className="lg:hidden" />

      <form role="search" onSubmit={onSubmit} className="relative hidden max-w-[520px] flex-1 sm:block">
        <label htmlFor="shell-search" className="sr-only">
          Search projects
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          id="shell-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects…"
          autoComplete="off"
          className="h-11 w-full rounded-[10px] border border-line bg-surface-2 pl-10 pr-14 text-[14.5px] text-ink placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/20 focus-visible:ring-offset-0"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink-2 md:block">
          ⌘K
        </kbd>
      </form>

      <span className="flex-1" />
      <ThemeToggle />
    </header>
  );
}
