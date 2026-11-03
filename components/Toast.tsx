"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ToastType = "success" | "error" | "warning" | "info";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const ICON_TONES: Record<ToastType, string> = {
  success: "bg-success-soft text-success",
  error: "bg-danger-soft text-danger",
  warning: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
};

const DEFAULT_DURATION = 5000;

function ToastCard({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const Icon = ICONS[type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      role={type === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3 pr-2 text-ink shadow-pop"
    >
      <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-md", ICON_TONES[type])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 self-center break-words text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

const viewportClass =
  "pointer-events-none fixed inset-x-4 top-4 z-[9999] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:w-[380px]";

/* ---------------------------------------------------------------- */
/* Global toasts: call notify() from anywhere, render <Toaster /> once. */
/* ---------------------------------------------------------------- */

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const EMPTY: ToastItem[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  items = items.filter((item) => item.id !== id);
  emit();
}

function show(message: string, type: ToastType = "info", duration = DEFAULT_DURATION) {
  const id = nextId++;
  items = [...items.slice(-3), { id, message, type }];
  if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration));
  emit();
  return id;
}

/**
 * Show a toast from anywhere (no hook or provider needed).
 * `notify("Saved")`, `notify.success("Copied")`, `notify.error(message)`.
 * Returns an id that can be passed to `notify.dismiss(id)`.
 */
export const notify = Object.assign(show, {
  success: (message: string, duration?: number) => show(message, "success", duration),
  error: (message: string, duration?: number) => show(message, "error", duration),
  warning: (message: string, duration?: number) => show(message, "warning", duration),
  info: (message: string, duration?: number) => show(message, "info", duration),
  dismiss,
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Renders toasts queued with `notify()`. Mounted once in the root layout. */
export function Toaster() {
  const queue = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div className={viewportClass} aria-live="polite">
      <AnimatePresence initial={false}>
        {queue.map((item) => (
          <ToastCard key={item.id} message={item.message} type={item.type} onClose={() => dismiss(item.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
