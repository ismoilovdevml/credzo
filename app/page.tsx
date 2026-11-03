import type { Metadata } from "next";
import { Features } from "@/components/landing/Features";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { ServicesStrip } from "@/components/landing/ServicesStrip";

export const metadata: Metadata = {
  title: { absolute: "Credzo · Self-hosted credential vault for teams" },
  description:
    "Credzo keeps servers, databases and API keys encrypted and organised by project and environment, with role-based access and a full audit trail. Self-hosted with Docker.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 font-semibold text-ink shadow-pop focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <LandingHeader />
      <main id="main" className="flex-1">
        <Hero />
        <ServicesStrip />
        <Features />
        <HowItWorks />
        <SecuritySection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
