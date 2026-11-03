import { useCallback, useEffect, useRef, useState } from "react";

/** Default delay before a copied secret is wiped from the clipboard. */
export const CLIPBOARD_CLEAR_MS = 30_000;

let clearTimer: ReturnType<typeof setTimeout> | null = null;

/** Copy via a hidden textarea; works on plain-HTTP self-hosted installs where navigator.clipboard is unavailable. */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
  }
  return ok;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy path (e.g. document not focused, permission denied).
    }
  }
  if (!legacyCopy(text)) throw new Error("Clipboard is not available in this browser");
}

/**
 * Copies `text` to the clipboard. When `clearAfterMs` > 0 the clipboard is
 * emptied after that delay, unless something else was copied through this
 * helper in the meantime. Throws if the browser refuses the copy.
 */
export async function copyText(text: string, clearAfterMs = 0): Promise<void> {
  await writeClipboard(text);
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  if (clearAfterMs > 0) {
    clearTimer = setTimeout(() => {
      clearTimer = null;
      writeClipboard("").catch(() => {
        // Best effort: the tab may be in the background, where browsers block clipboard writes.
      });
    }, clearAfterMs);
  }
}

/**
 * `copy(text)` + a `copied` flag that resets after `resetMs` (for a check-mark state).
 * Errors propagate so the caller can show a toast.
 */
export function useClipboard({ clearAfterMs = 0, resetMs = 1600 }: { clearAfterMs?: number; resetMs?: number } = {}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const copy = useCallback(
    async (text: string) => {
      await copyText(text, clearAfterMs);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), resetMs);
    },
    [clearAfterMs, resetMs]
  );

  return { copy, copied };
}
