"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { notify } from "@/components/Toast";
import { IconButton } from "@/components/ui";
import { CLIPBOARD_CLEAR_MS, useClipboard } from "@/hooks/useClipboard";
import { apiRequest, errorMessage } from "./api";
import { fieldLabel, primarySecretField, type CredentialView } from "./model";

/** Reveals the credential's primary secret (audit-logged) and copies it; the clipboard is wiped after 30 s. */
export function CopySecretButton({ credential }: { credential: CredentialView }) {
  const { copy, copied } = useClipboard({ clearAfterMs: CLIPBOARD_CLEAR_MS });
  const [busy, setBusy] = useState(false);
  const field = primarySecretField(credential);
  const label = field ? `Copy ${fieldLabel(credential.type, field).toLowerCase()}` : "No secret to copy";

  const handleCopy = async () => {
    if (!field) return;
    setBusy(true);
    try {
      const { fields } = await apiRequest<{ fields: Record<string, string> }>(
        `/api/credentials/${encodeURIComponent(credential.id)}/reveal`,
        { method: "POST" }
      );
      const secret = fields[field];
      if (!secret) throw new Error("This credential has no secret value to copy");
      await copy(secret);
      notify.success(`Copied. Clipboard clears in ${CLIPBOARD_CLEAR_MS / 1000}s.`);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't copy the secret"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IconButton
      label={copied ? "Copied" : label}
      onClick={handleCopy}
      disabled={!field || busy}
      aria-busy={busy || undefined}
      data-testid="copy-secret"
    >
      {copied ? <Check className="text-accent" /> : <Copy />}
    </IconButton>
  );
}
