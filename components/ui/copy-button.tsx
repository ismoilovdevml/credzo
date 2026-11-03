"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { notify } from "@/components/Toast";
import { CLIPBOARD_CLEAR_MS, useClipboard } from "@/hooks/useClipboard";
import { Button, IconButton } from "./button";

export interface CopyButtonProps {
  /** Text to copy, or a (possibly async) getter, e.g. one that decrypts a secret on demand. */
  value: string | (() => string | Promise<string>);
  /** Accessible name, e.g. "Copy password". Default "Copy". */
  label?: string;
  /** Secrets: wipe the clipboard after 30 s and say so in the toast. */
  sensitive?: boolean;
  /** Toast text on success. */
  successMessage?: string;
  /** "icon" = square ghost button (default); "button" = labelled secondary button. */
  variant?: "icon" | "button";
  size?: "sm" | "md";
  /** Label for the "button" variant. Defaults to `label`. */
  children?: ReactNode;
  /** Fires after a successful copy (e.g. to record an audit event). */
  onCopied?: () => void;
  className?: string;
}

/** Copies to the clipboard with a toast and a brief check-mark state. */
export function CopyButton({
  value,
  label = "Copy",
  sensitive = false,
  successMessage,
  variant = "icon",
  size = "md",
  children,
  onCopied,
  className,
}: CopyButtonProps) {
  const { copy, copied } = useClipboard({ clearAfterMs: sensitive ? CLIPBOARD_CLEAR_MS : 0 });
  const [busy, setBusy] = useState(false);

  const handleCopy = async () => {
    setBusy(true);
    try {
      const text = typeof value === "function" ? await value() : value;
      await copy(text);
      notify.success(
        successMessage ??
          (sensitive ? `Copied. Clipboard clears in ${CLIPBOARD_CLEAR_MS / 1000}s.` : "Copied to clipboard")
      );
      onCopied?.();
    } catch (error) {
      notify.error(error instanceof Error && error.message ? error.message : "Couldn't copy to clipboard");
    } finally {
      setBusy(false);
    }
  };

  const icon = copied ? <Check className="text-accent" /> : <Copy />;

  if (variant === "button") {
    return (
      <Button
        variant="secondary"
        size={size === "sm" ? "sm" : "md"}
        onClick={handleCopy}
        loading={busy}
        leftIcon={icon}
        className={className}
      >
        {copied ? "Copied" : (children ?? label)}
      </Button>
    );
  }

  return (
    <IconButton
      label={copied ? "Copied" : label}
      size={size === "sm" ? "sm" : "md"}
      onClick={handleCopy}
      disabled={busy}
      aria-busy={busy || undefined}
      className={className}
    >
      {icon}
    </IconButton>
  );
}
