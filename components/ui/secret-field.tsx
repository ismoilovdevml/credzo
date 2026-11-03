"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { notify } from "@/components/Toast";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "./button";
import { CopyButton } from "./copy-button";
import { Spinner } from "./spinner";

const MASK = "••••••••••••";

export interface SecretFieldProps {
  /** Plain value, when already loaded. Leave undefined and pass `reveal` to fetch on demand. */
  value?: string;
  /** Loads the secret on first reveal/copy (e.g. a decrypt API call). The result is cached. */
  reveal?: () => Promise<string>;
  /** What the secret is, used in button names: "Reveal password", "Copy password". Default "secret". */
  label?: string;
  /** Show the copy button. Default true. */
  copyable?: boolean;
  /** Re-mask after this many ms. Default 30 000; 0 keeps it visible. */
  autoHideMs?: number;
  /** Fires each time the value is shown (e.g. to record an audit event). */
  onReveal?: () => void;
  /** Fires after a successful copy. */
  onCopy?: () => void;
  className?: string;
}

/** Masked monospace secret with reveal and copy controls. Copies wipe the clipboard after 30 s. */
export function SecretField({
  value,
  reveal,
  label = "secret",
  copyable = true,
  autoHideMs = 30_000,
  onReveal,
  onCopy,
  className,
}: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState<string | null>(null);
  const secret = value ?? fetched;

  useEffect(() => {
    if (!revealed || autoHideMs <= 0) return;
    const timer = setTimeout(() => setRevealed(false), autoHideMs);
    return () => clearTimeout(timer);
  }, [revealed, autoHideMs]);

  const load = async (): Promise<string> => {
    if (secret !== null) return secret;
    if (!reveal) throw new Error(`No ${label} to show`);
    const result = await reveal();
    setFetched(result);
    return result;
  };

  const toggle = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    setLoading(true);
    try {
      await load();
      setRevealed(true);
      onReveal?.();
    } catch (error) {
      notify.error(error instanceof Error && error.message ? error.message : `Couldn't load the ${label}`);
    } finally {
      setLoading(false);
    }
  };

  if (value === "" && !reveal) {
    return <span className={cn("text-[14px] text-muted", className)}>Not set</span>;
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <span
        className={cn(
          "min-w-0 flex-1 break-all font-mono text-[14px] text-ink",
          !revealed && "select-none tracking-[0.08em] text-ink-2"
        )}
        aria-label={revealed ? undefined : `${label} hidden`}
      >
        {revealed && secret !== null ? secret : MASK}
      </span>
      <div className="flex flex-none items-center">
        <IconButton
          label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          aria-pressed={revealed}
          onClick={toggle}
          disabled={loading}
          className="text-accent-ink"
        >
          {loading ? <Spinner className="h-4 w-4" /> : revealed ? <EyeOff /> : <Eye />}
        </IconButton>
        {copyable && <CopyButton value={load} label={`Copy ${label}`} sensitive onCopied={onCopy} className="text-accent-ink" />}
      </div>
    </div>
  );
}
