"use client";

import { useRef, type KeyboardEvent } from "react";
import { Card, CardTitle } from "@/components/ui";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils/cn";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match system" },
];

/** Miniature app frame drawn with theme tokens; the `light` / `dark` class scopes that palette to the preview. */
function Preview({ scheme }: { scheme: "light" | "dark" }) {
  return (
    <span className={cn("flex h-full w-full gap-1.5 bg-canvas p-2", scheme)}>
      <span className="w-[26%] rounded-[5px] bg-surface" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="h-3 w-3/5 rounded-[3px] bg-line-strong" />
        <span className="flex-1 rounded-[5px] border border-line bg-surface-2" />
      </span>
    </span>
  );
}

/** Theme picker: Light / Dark / Match system, applied instantly and stored per browser. */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Radio-group arrow-key navigation (roving tabindex).
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const nextIndex = (index + delta + OPTIONS.length) % OPTIONS.length;
    setTheme(OPTIONS[nextIndex].value);
    refs.current[nextIndex]?.focus();
  };

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <CardTitle id="appearance-title">Appearance</CardTitle>
      <div role="radiogroup" aria-labelledby="appearance-title" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        {OPTIONS.map((option, index) => {
          const checked = theme === option.value;
          return (
            <button
              key={option.value}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-testid={`theme-${option.value}`}
              onClick={() => setTheme(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "flex flex-col gap-2.5 rounded-[14px] bg-surface text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                // Border + padding add up to 12px either way, so the card never shifts when selected.
                checked ? "border-2 border-accent p-2.5" : "border border-line p-[11px] hover:border-line-strong"
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-[84px] overflow-hidden rounded-[9px] border border-line"
              >
                {option.value === "system" ? (
                  <>
                    <span className="w-1/2 overflow-hidden">
                      <Preview scheme="light" />
                    </span>
                    <span className="w-1/2 overflow-hidden">
                      <Preview scheme="dark" />
                    </span>
                  </>
                ) : (
                  <Preview scheme={option.value} />
                )}
              </span>
              <span className="px-1 text-[14.5px] font-semibold text-ink">{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[13.5px] text-muted">
        Dark mode uses soft grey surfaces and lower-contrast borders to reduce glare at night.
      </p>
    </Card>
  );
}
