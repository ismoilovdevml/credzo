import type { Metadata } from "next";
import { OpenShare } from "@/components/generator/OpenShare";

export const metadata: Metadata = {
  title: "Secure secret",
  description: "A one-time, end-to-end encrypted secret shared with Credzo.",
  // Links must not be indexed, cached or leaked to other sites through the Referer header.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpenShare id={id} />;
}
