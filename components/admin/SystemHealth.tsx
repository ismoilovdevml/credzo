import type { ReactNode } from "react";
import { Card, CardTitle } from "@/components/ui";
import type { AdminStats } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "./format";

interface HealthRowProps {
  label: string;
  value: ReactNode;
  warn?: boolean;
}

function HealthRow({ label, value, warn }: HealthRowProps) {
  return (
    <li className="flex items-start gap-2.5 text-[14px]">
      <span
        aria-hidden="true"
        className={cn("mt-[5px] h-2.5 w-2.5 flex-none rounded-full", warn ? "bg-warn" : "bg-success")}
      />
      <span className="flex-1 text-ink">
        {label}
        <span className="sr-only">{warn ? " (needs attention)" : " (healthy)"}</span>
      </span>
      <span className={cn("min-w-0 text-right", warn ? "font-semibold text-warn" : "text-muted")}>{value}</span>
    </li>
  );
}

/** Platform-only runtime facts: database size, where the encryption key came from, sessions, version. */
export function SystemHealth({ system }: { system: AdminStats["system"] }) {
  const keyFromFile = system.encryptionKeySource === "file";
  return (
    <Card padded className="flex flex-col gap-3.5" data-testid="system-health">
      <CardTitle className="text-base">System health</CardTitle>
      <ul className="flex flex-col gap-3">
        <HealthRow label="Database" value={`SQLite · ${formatBytes(system.dbSizeBytes)}`} />
        <HealthRow
          label="Encryption key"
          warn={keyFromFile}
          value={
            keyFromFile ? (
              <>
                Generated key file — set <code className="font-mono text-[12.5px]">CREDZO_ENCRYPTION_KEY</code>
              </>
            ) : (
              "Loaded from environment"
            )
          }
        />
        <HealthRow label="Sessions" value={`${system.activeSessions.toLocaleString()} active`} />
        <HealthRow
          label="Version"
          value={<span className="font-mono text-[13px]">v{system.version}</span>}
        />
      </ul>
    </Card>
  );
}
