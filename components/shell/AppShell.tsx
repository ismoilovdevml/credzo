"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Spinner } from "@/components/ui/spinner";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { SidebarContent } from "./Sidebar";
import { useSession } from "./SessionProvider";
import { Topbar } from "./Topbar";

function FullScreenStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-4 text-center">
      <Logo size="lg" />
      {children}
    </div>
  );
}

function SessionError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <FullScreenStatus>
      <div role="alert" className="flex max-w-sm flex-col items-center gap-2">
        <h1 className="text-lg font-bold text-ink">Couldn&apos;t load your workspace</h1>
        <p className="text-[14px] text-muted">{message}</p>
      </div>
      <Button
        variant="secondary"
        loading={retrying}
        leftIcon={<RefreshCw />}
        onClick={async () => {
          setRetrying(true);
          await onRetry();
          setRetrying(false);
        }}
      >
        Try again
      </Button>
    </FullScreenStatus>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef, { onEscape: onClose });

  // The drawer only exists below lg; close it (releasing the scroll lock) if the viewport grows past that.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (query.matches) onClose();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-[rgb(10_14_20/0.5)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 w-[284px] max-w-[85vw] overflow-y-auto border-r border-line bg-surface shadow-pop outline-none"
          >
            <IconButton label="Close navigation" onClick={onClose} className="absolute right-2 top-3.5 z-10">
              <X />
            </IconButton>
            <SidebarContent onNavigate={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Authenticated app frame: sidebar (drawer below lg), top bar and main content area. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  if (!user) {
    if (error && !loading) return <SessionError message={error} onRetry={refresh} />;
    return (
      <FullScreenStatus>
        <Spinner className="h-6 w-6 text-accent" label="Loading your workspace" />
      </FullScreenStatus>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only z-[80] rounded-lg bg-surface px-4 py-2 font-semibold text-ink shadow-pop focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] overflow-y-auto border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[264px]">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} menuOpen={drawerOpen} />
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <div className="w-full max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
