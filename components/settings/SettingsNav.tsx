"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface SettingsNavItem {
  id: string;
  label: string;
  danger?: boolean;
}

/**
 * In-page section navigation. A sticky vertical list on wide screens, a sticky
 * horizontal scroller below xl. Highlights the section currently in view.
 */
export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = items.find((item) => visible.has(item.id));
        if (first) setActive(first.id);
      },
      // A section counts as current once it reaches the band just under the sticky headers.
      { rootMargin: "-160px 0px -55% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  // Keep the active pill visible in the horizontal scroller.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    const target = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, target) });
  }, [active]);

  return (
    <nav
      aria-label="Settings sections"
      data-testid="settings-nav"
      className="sticky top-16 z-20 -mx-4 border-b border-line bg-canvas/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-canvas/80 sm:-mx-6 sm:px-6 lg:top-[77px] lg:-mx-8 lg:px-8 xl:top-[101px] xl:mx-0 xl:self-start xl:border-0 xl:bg-transparent xl:px-0 xl:backdrop-blur-none"
    >
      <ul
        ref={listRef}
        className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] xl:flex-col xl:gap-0.5 xl:overflow-visible xl:py-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id} className="flex-none">
              <a
                href={`#${item.id}`}
                data-section={item.id}
                aria-current={current ? "location" : undefined}
                onClick={() => setActive(item.id)}
                className={cn(
                  "block whitespace-nowrap rounded-lg border px-3 py-2 text-[14px] transition-colors xl:py-2.5 xl:text-[14.5px]",
                  current
                    ? "border-line bg-surface font-semibold text-ink shadow-card"
                    : "border-transparent text-ink-2 hover:bg-ink/[0.05] hover:text-ink",
                  item.danger && "text-danger hover:text-danger"
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
