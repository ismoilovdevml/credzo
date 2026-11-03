"use client";

import {
  createContext,
  useContext,
  useId,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab components must be rendered inside <Tabs>");
  return ctx;
}

const tabId = (baseId: string, value: string) => `${baseId}-tab-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}-panel-${value}`;

export interface TabsProps {
  /** Controlled active tab value. */
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Underlined tabs (WAI-ARIA tabs pattern, automatic activation).
 * <Tabs value onValueChange><TabList aria-label><Tab value>…</Tab></TabList><TabPanel value>…</TabPanel></Tabs>
 */
export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, onValueChange, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { "aria-label": string }) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn("-mb-px flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  children: ReactNode;
  /** Muted number after the label. */
  count?: number;
  disabled?: boolean;
  className?: string;
}

export function Tab({ value, children, count, disabled, className }: TabProps) {
  const { value: active, onValueChange, baseId } = useTabs();
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      id={tabId(baseId, value)}
      aria-selected={selected}
      aria-controls={panelId(baseId, value)}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={cn(
        "-mb-px inline-flex h-11 flex-none items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-[14.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
        selected ? "border-accent font-semibold text-accent-ink" : "border-transparent font-medium text-ink-2 hover:text-ink",
        className
      )}
    >
      {children}
      {count !== undefined && <span className="font-medium text-muted">{count}</span>}
    </button>
  );
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: active, baseId } = useTabs();
  if (active !== value) return null;
  return (
    <div role="tabpanel" id={panelId(baseId, value)} aria-labelledby={tabId(baseId, value)} tabIndex={0} className={className}>
      {children}
    </div>
  );
}
