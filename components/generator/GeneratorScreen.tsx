"use client";

import { useState } from "react";
import { Card, CardDescription, CardTitle, PageHeader, Skeleton } from "@/components/ui";
import { useIsClient } from "@/hooks/useIsClient";
import { DEFAULT_PASSWORD_OPTIONS, generatePassword, type PasswordOptions } from "@/lib/password-generator";
import { ActiveLinks } from "./ActiveLinks";
import { PasswordGenerator } from "./PasswordGenerator";
import { ShareForm } from "./ShareForm";

/** Generator & secure share screen. Random values only exist in the browser, so the tools mount client-side. */
export function GeneratorScreen() {
  const isClient = useIsClient();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Generator & secure share"
        description="Create strong secrets and hand them over without pasting them into chat."
      />
      {isClient ? <GeneratorWorkspace /> : <WorkspaceSkeleton />}
    </div>
  );
}

function GeneratorWorkspace() {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [password, setPassword] = useState(() => generatePassword(DEFAULT_PASSWORD_OPTIONS));
  const [linksVersion, setLinksVersion] = useState(0);

  const updateOptions = (next: PasswordOptions) => {
    setOptions(next);
    setPassword(generatePassword(next));
  };

  return (
    <div className="flex flex-wrap items-start gap-5">
      <PasswordGenerator
        password={password}
        options={options}
        onOptionsChange={updateOptions}
        onRegenerate={() => setPassword(generatePassword(options))}
      />
      <Card className="flex flex-[1_1_400px] flex-col gap-[18px] p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <CardTitle>One-time secure link</CardTitle>
          <CardDescription className="text-[14px] leading-relaxed">
            The secret is encrypted in your browser, and the key travels only inside the link. It is deleted from the
            server once opened.
          </CardDescription>
        </div>
        <ShareForm generatedPassword={password} onCreated={() => setLinksVersion((value) => value + 1)} />
        <ActiveLinks reloadKey={linksVersion} />
      </Card>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex flex-wrap items-start gap-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-[520px] min-w-0 flex-[1_1_440px] rounded-2xl" />
      <Skeleton className="h-[520px] min-w-0 flex-[1_1_400px] rounded-2xl" />
    </div>
  );
}
