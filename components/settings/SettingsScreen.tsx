"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Card, PageHeader, Skeleton } from "@/components/ui";
import type { PublicUser } from "@/lib/types";
import { api } from "@/lib/api-client";
import { errorMessage } from "./api";
import { AppearanceSection } from "./AppearanceSection";
import { DangerZoneSection } from "./DangerZoneSection";
import { DataSection } from "./DataSection";
import { ProfileSection } from "./ProfileSection";
import { SecuritySection } from "./SecuritySection";
import { SettingsNav, type SettingsNavItem } from "./SettingsNav";

const SECTIONS: SettingsNavItem[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "appearance", label: "Appearance" },
  { id: "data", label: "Import & export" },
  { id: "danger", label: "Danger zone", danger: true },
];

function ProfileSkeleton() {
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6" aria-busy="true">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function SecuritySkeleton() {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6" aria-busy="true">
      <Skeleton className="h-5 w-24" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3.5 w-56 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32 flex-none rounded-lg" />
        </div>
      ))}
    </Card>
  );
}

/** Anchor target for the section nav; the offset clears the sticky top bar (and the nav strip below xl). */
function Section({ id, children }: { id: string; children: ReactNode }) {
  const label = SECTIONS.find((section) => section.id === id)?.label;
  return (
    <section id={id} aria-label={label} className="scroll-mt-[136px] lg:scroll-mt-[149px] xl:scroll-mt-[101px]">
      {children}
    </section>
  );
}

/** Account settings: profile, security, appearance, import/export and the danger zone. */
export function SettingsScreen() {
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  // Re-runs on retry; `reloadProfile` refreshes in place without blanking the cards.
  useEffect(() => {
    let cancelled = false;
    api.get<PublicUser>("/api/user-profile")
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error, "Couldn't load your account"));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reloadProfile = useCallback(() => setAttempt((value) => value + 1), []);

  const patchProfile = useCallback((changes: Partial<PublicUser>) => {
    setProfile((current) => (current ? { ...current, ...changes } : current));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[208px_minmax(0,1fr)] xl:items-start xl:gap-7">
        <SettingsNav items={SECTIONS} />

        <div className="flex min-w-0 flex-col gap-5">
          <Section id="profile">
            {profile ? (
              <ProfileSection profile={profile} onSaved={setProfile} />
            ) : loadError ? (
              <Card role="alert" className="flex flex-wrap items-center gap-3 p-5 sm:p-6">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[15px] font-semibold text-ink">Couldn&apos;t load your profile and security settings</p>
                  <p className="text-[14px] text-muted">{loadError}</p>
                </div>
                <Button variant="secondary" size="sm" leftIcon={<RefreshCw />} onClick={reloadProfile}>
                  Try again
                </Button>
              </Card>
            ) : (
              <ProfileSkeleton />
            )}
          </Section>
          <Section id="security">
            {profile ? (
              <SecuritySection profile={profile} onProfileChange={patchProfile} reloadProfile={reloadProfile} />
            ) : (
              !loadError && <SecuritySkeleton />
            )}
          </Section>
          <Section id="appearance">
            <AppearanceSection />
          </Section>
          <Section id="data">
            <DataSection />
          </Section>
          <Section id="danger">
            <DangerZoneSection />
          </Section>
        </div>
      </div>
    </div>
  );
}
