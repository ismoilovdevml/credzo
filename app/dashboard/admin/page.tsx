import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/AdminOverview";

export const metadata: Metadata = { title: "Admin overview" };

export default function AdminPage() {
  return (
    <Suspense>
      <AdminOverview />
    </Suspense>
  );
}
