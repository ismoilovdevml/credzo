"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import { SECTION_LINKS } from "./links";

const MENU_ID = "landing-mobile-menu";

/** Hamburger menu for screens narrower than the inline navigation (below `lg`). */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="lg:hidden">
      <IconButton
        ref={toggleRef}
        variant="secondary"
        label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => setOpen((value) => !value)}
        data-testid="landing-mobile-menu-button"
      >
        {open ? <X /> : <Menu />}
      </IconButton>

      <div
        id={MENU_ID}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-pop animate-fade-in"
        data-testid="landing-mobile-menu"
      >
        <nav aria-label="Sections" className="mx-auto flex max-w-[1200px] flex-col px-4 py-3 sm:px-6">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={close}
              className="rounded-lg px-3 py-3 text-[15px] font-medium text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line-soft pt-4 sm:hidden">
            <Button asChild variant="secondary">
              <Link href="/login" onClick={close}>
                Sign in
              </Link>
            </Button>
            <Button asChild>
              <Link href="/signup" onClick={close}>
                Get started
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </div>
  );
}
