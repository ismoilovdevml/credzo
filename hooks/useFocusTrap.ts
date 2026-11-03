import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Visible, focusable descendants of `container`, in DOM order. */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0
  );
}

/** Stack of active traps so nested overlays only react to keys when they are on top. */
const trapStack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = "";

interface FocusTrapOptions {
  /** Called when Escape is pressed while this trap is the top-most one. */
  onEscape?: () => void;
  /** Element to focus on open. Defaults to the first focusable child, then the container. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Prevent the page behind from scrolling while active. Default true. */
  lockScroll?: boolean;
}

/**
 * Keeps keyboard focus inside `containerRef` while `active`, closes on Escape,
 * and restores focus to the previously focused element when deactivated.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  { onEscape, initialFocusRef, lockScroll = true }: FocusTrapOptions = {}
) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const id = Symbol("focus-trap");
    trapStack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const target = initialFocusRef?.current ?? getFocusable(container)[0] ?? container;
    target.focus({ preventScroll: true });

    if (lockScroll) {
      if (scrollLocks === 0) {
        savedOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
      scrollLocks += 1;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (trapStack[trapStack.length - 1] !== id) return;
      // A portaled popup (DropdownMenu) opened from inside this trap handles its own keys.
      const active = document.activeElement;
      if (active instanceof HTMLElement && !container.contains(active) && active.closest('[role="menu"]')) return;
      if (event.key === "Escape") {
        if (onEscapeRef.current) {
          event.stopPropagation();
          onEscapeRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const index = trapStack.indexOf(id);
      if (index !== -1) trapStack.splice(index, 1);
      if (lockScroll) {
        scrollLocks -= 1;
        if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
      }
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocusRef, lockScroll]);
}
