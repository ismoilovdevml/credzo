"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useIsClient } from "@/hooks/useIsClient";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "./button";

const CENTER_SIZES = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[680px]",
} as const;

const DRAWER_SIZES = {
  sm: "max-w-[420px]",
  md: "max-w-[520px]",
  lg: "max-w-[620px]",
} as const;

export interface ModalProps {
  open: boolean;
  /** Called on Escape, backdrop click and the close button (unless `dismissible` is false). */
  onClose: () => void;
  /** Visible heading; also the dialog's accessible name. */
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action row pinned to the bottom (buttons are right-aligned and wrap on mobile). */
  footer?: ReactNode;
  size?: keyof typeof CENTER_SIZES;
  /** "center" dialog (bottom sheet on phones) or "right" side drawer. */
  placement?: "center" | "right";
  /** Element to focus on open; defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Set false while a request is in flight to block Escape/backdrop closing. Default true. */
  dismissible?: boolean;
  /** Extra classes for the scrollable body. */
  bodyClassName?: string;
  /** Use "alertdialog" for destructive confirmations. */
  role?: "dialog" | "alertdialog";
}

/** Accessible modal: portal, focus trap, Escape to close, scroll lock, focus restore. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  placement = "center",
  initialFocusRef,
  dismissible = true,
  bodyClassName,
  role = "dialog",
}: ModalProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap(open && isClient, panelRef, { onEscape: dismissible ? onClose : undefined, initialFocusRef });

  if (!isClient) return null;

  const isDrawer = placement === "right";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-[60] flex",
            isDrawer ? "justify-end" : "items-end justify-center sm:items-center sm:p-4"
          )}
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-[rgb(10_14_20/0.55)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            ref={panelRef}
            role={role}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={isDrawer ? { x: 40, opacity: 0 } : { y: 16, opacity: 0, scale: 0.985 }}
            animate={isDrawer ? { x: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={isDrawer ? { x: 40, opacity: 0 } : { y: 12, opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "relative flex w-full flex-col bg-surface text-ink shadow-pop outline-none",
              isDrawer
                ? cn("h-full border-l border-line", DRAWER_SIZES[size])
                : cn("max-h-[92dvh] rounded-t-2xl border border-line sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl", CENTER_SIZES[size])
            )}
          >
            <div className="flex items-start gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
                <h2 id={titleId} className="text-lg font-bold leading-snug tracking-tight text-ink">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="text-[14px] leading-relaxed text-muted">
                    {description}
                  </p>
                )}
              </div>
              {dismissible && (
                <IconButton label="Close" onClick={onClose} className="-mr-2">
                  <X />
                </IconButton>
              )}
            </div>
            <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
            {footer && (
              <div
                className={cn(
                  "flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-surface-2 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6",
                  !isDrawer && "sm:rounded-b-2xl"
                )}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
