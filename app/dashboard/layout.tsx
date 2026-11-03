import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { SessionProvider } from "@/components/shell/SessionProvider";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
