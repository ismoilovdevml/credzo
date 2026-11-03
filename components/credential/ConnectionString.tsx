"use client";

import { CopyButton } from "@/components/ui";
import { MASKED, buildConnectionString } from "./connection-string";

export interface ConnectionStringProps {
  type: string;
  fields: Record<string, string>;
  /** The credential stores a password (a secret field). */
  hasPassword: boolean;
  /** Password value once revealed on screen; null while masked. */
  revealedPassword: string | null;
  /** Loads the password for copying without showing it. */
  getPassword: () => Promise<string>;
}

/** Client-built connection URI; the password stays masked until the password field is revealed. */
export function ConnectionString({ type, fields, hasPassword, revealedPassword, getPassword }: ConnectionStringProps) {
  const display = buildConnectionString(type, fields, hasPassword ? (revealedPassword ?? MASKED) : null);
  if (!display) return null;

  const copyValue = async () => {
    const value = buildConnectionString(type, fields, hasPassword ? await getPassword() : null);
    if (!value) throw new Error("Couldn't build the connection string");
    return value;
  };

  return (
    <section aria-labelledby="connection-string-label" className="flex flex-col gap-2">
      <h2 id="connection-string-label" className="text-[13.5px] font-semibold text-ink-2">
        Connection string
      </h2>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 py-1.5 pl-3.5 pr-1.5">
        <code
          data-testid="connection-string"
          className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-2 font-mono text-[13px] text-ink"
        >
          {display}
        </code>
        <CopyButton
          value={copyValue}
          label="Copy connection string"
          sensitive={hasPassword}
          data-testid="copy-connection-string"
        />
      </div>
    </section>
  );
}
