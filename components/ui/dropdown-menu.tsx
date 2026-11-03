"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { useIsClient } from "@/hooks/useIsClient";
import { cn } from "@/lib/utils/cn";

const VIEWPORT_GAP = 8;
const TRIGGER_GAP = 6;

interface MenuContextValue {
  close: (restoreFocus?: boolean) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("DropdownMenu items must be rendered inside <DropdownMenu>");
  return ctx;
}

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
}

export interface DropdownMenuProps {
  /** A single focusable element (Button / IconButton). It receives aria-haspopup, aria-expanded and the click handler. */
  trigger: ReactElement;
  children: ReactNode;
  /** Horizontal alignment relative to the trigger. Default "end". */
  align?: "start" | "end";
  /** Preferred side; flips automatically when there is no room. Default "bottom". */
  side?: "bottom" | "top";
  /** Accessible name of the menu; defaults to the trigger's label. */
  label?: string;
  className?: string;
}

/**
 * Accessible menu button. Rendered in a portal with fixed positioning, so it
 * is never clipped by scroll containers (tables, cards). Arrow keys, Home/End,
 * Escape and Tab behave per the WAI-ARIA menu button pattern.
 */
export function DropdownMenu({ trigger, children, align = "end", side = "bottom", label, className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const isClient = useIsClient();
  const triggerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const triggerId = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const position = useCallback(() => {
    const triggerEl = triggerRef.current;
    const menu = menuRef.current;
    if (!triggerEl || !menu) return;
    const rect = triggerEl.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = menu;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const below = rect.bottom + TRIGGER_GAP;
    const above = rect.top - TRIGGER_GAP - height;
    const fitsBelow = below + height <= viewportH - VIEWPORT_GAP;
    const fitsAbove = above >= VIEWPORT_GAP;
    const top = side === "top" ? (fitsAbove || !fitsBelow ? above : below) : fitsBelow || !fitsAbove ? below : above;

    const preferredLeft = align === "end" ? rect.right - width : rect.left;
    const left = Math.min(Math.max(VIEWPORT_GAP, preferredLeft), viewportW - width - VIEWPORT_GAP);

    menu.style.top = `${Math.max(VIEWPORT_GAP, top)}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = "visible";
  }, [align, side]);

  useLayoutEffect(() => {
    if (!open) return;
    position();
    menuItems(menuRef.current)[0]?.focus({ preventScroll: true });
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, close, position]);

  const onTriggerKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(menuRef.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case "Tab":
        event.preventDefault();
        close();
        break;
    }
  };

  return (
    <MenuContext.Provider value={{ close }}>
      <Slot
        ref={triggerRef}
        id={triggerId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
      >
        {trigger}
      </Slot>
      {isClient &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            aria-labelledby={label ? undefined : triggerId}
            onKeyDown={onMenuKeyDown}
            style={{ visibility: "hidden" }}
            className={cn(
              "fixed z-[70] min-w-[200px] max-w-[calc(100vw-16px)] animate-fade-in rounded-xl border border-line bg-surface p-1.5 text-ink shadow-pop",
              className
            )}
          >
            {children}
          </div>,
          document.body
        )}
    </MenuContext.Provider>
  );
}

const itemClass =
  "flex min-h-[40px] w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] font-medium outline-none transition-colors focus-visible:ring-0 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:flex-none";

export interface DropdownMenuItemProps {
  children: ReactNode;
  /** Leading lucide icon element. */
  icon?: ReactNode;
  /** Runs before the menu closes. */
  onSelect?: () => void;
  /** Render as a Next link instead of a button. */
  href?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Right-aligned hint, e.g. a shortcut or "Active". */
  trailing?: ReactNode;
}

export function DropdownMenuItem({ children, icon, onSelect, href, tone = "default", disabled, trailing }: DropdownMenuItemProps) {
  const { close } = useMenu();
  const className = cn(
    itemClass,
    tone === "danger"
      ? "text-danger hover:bg-danger-soft focus:bg-danger-soft"
      : "text-ink-2 hover:bg-ink/[0.05] hover:text-ink focus:bg-ink/[0.06] focus:text-ink",
    disabled && "pointer-events-none opacity-50"
  );
  const content = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing && <span className="ml-3 text-[12.5px] font-normal text-muted">{trailing}</span>}
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        role="menuitem"
        tabIndex={-1}
        className={className}
        onClick={() => {
          onSelect?.();
          close(false);
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      className={className}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        close();
      }}
    >
      {content}
    </button>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div role="presentation" className="px-2.5 pb-1 pt-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">
      {children}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="-mx-1.5 my-1.5 h-px bg-line-soft" />;
}
