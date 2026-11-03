import { Suspense } from "react";
import type { Metadata } from "next";
import { AuditLogScreen } from "@/components/audit/AuditLogScreen";
import { AuditLogSkeleton } from "@/components/audit/AuditLogSkeleton";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return (
    <Suspense fallback={<AuditLogSkeleton />}>
      <AuditLogScreen />
    </Suspense>
  );
}
