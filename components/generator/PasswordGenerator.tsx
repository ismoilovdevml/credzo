"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { Button, Card, CardTitle, Checkbox } from "@/components/ui";
import { notify } from "@/components/Toast";
import { CLIPBOARD_CLEAR_MS, useClipboard } from "@/hooks/useClipboard";
import { cn } from "@/lib/utils/cn";
import {
  AMBIGUOUS_CHARACTERS,
  CHARSET_KEYS,
  PASSWORD_LENGTHS,
  estimateStrength,
  type CharsetKey,
  type PasswordOptions,
  type StrengthLevel,
} from "@/lib/password-generator";
import { SaveCredentialModal } from "./SaveCredentialModal";

const CHARSET_LABELS: Record<CharsetKey, { label: string; sample: (excludeAmbiguous: boolean) => string }> = {
  upper: { label: "Uppercase", sample: () => "A–Z" },
  lower: { label: "Lowercase", sample: () => "a–z" },
  digits: { label: "Numbers", sample: (excludeAmbiguous) => (excludeAmbiguous ? "2–9" : "0–9") },
  symbols: { label: "Symbols", sample: () => "!@#$%&*" },
};

const STRENGTH_TONES: Record<StrengthLevel, { text: string; bar: string }> = {
  1: { text: "text-danger", bar: "bg-danger" },
  2: { text: "text-warn", bar: "bg-warn" },
  3: { text: "text-accent", bar: "bg-accent" },
  4: { text: "text-accent", bar: "bg-accent" },
};

export interface PasswordGeneratorProps {
  password: string;
  options: PasswordOptions;
  onOptionsChange: (options: PasswordOptions) => void;
  onRegenerate: () => void;
}

export function PasswordGenerator({ password, options, onOptionsChange, onRegenerate }: PasswordGeneratorProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const { copy, copied } = useClipboard({ clearAfterMs: CLIPBOARD_CLEAR_MS });
  const strength = estimateStrength(options);
  const tone = STRENGTH_TONES[strength.level];
  const enabledCount = CHARSET_KEYS.filter((key) => options.sets[key]).length;

  const handleCopy = async () => {
    try {
      await copy(password);
      notify.success(`Password copied. Clipboard clears in ${CLIPBOARD_CLEAR_MS / 1000}s.`);
    } catch (error) {
      notify.error(error instanceof Error && error.message ? error.message : "Couldn't copy to clipboard");
    }
  };

  const toggleSet = (key: CharsetKey) => {
    const enabled = !options.sets[key];
    if (!enabled && enabledCount === 1) return;
    onOptionsChange({ ...options, sets: { ...options.sets, [key]: enabled } });
  };

  return (
    <Card className="flex flex-[1_1_440px] flex-col gap-5 p-5 sm:p-6">
      <CardTitle>Password generator</CardTitle>

      {/* Always-dark output panel: the scoped `dark` class switches the design tokens inside it. */}
      <div className="dark flex flex-col gap-3.5 rounded-[14px] border border-line bg-track p-4 text-ink sm:p-[18px]">
        <output
          aria-live="polite"
          aria-label="Generated password"
          data-testid="generator-output"
          className="min-h-[60px] break-all font-mono text-[18px] leading-normal text-ink sm:text-[20px]"
        >
          {password}
        </output>
        <div className="flex flex-wrap items-center gap-2.5">
          <span data-testid="generator-strength" className={cn("flex items-center gap-2 text-[13.5px] font-semibold", tone.text)}>
            <span className="flex gap-[3px]" aria-hidden="true">
              {([1, 2, 3, 4] as const).map((bar) => (
                <span
                  key={bar}
                  className={cn("h-1.5 w-[18px] rounded-full", bar <= strength.level ? tone.bar : "bg-line-strong")}
                />
              ))}
            </span>
            {strength.label} · ~{strength.bits} bits
          </span>
          <span className="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            onClick={onRegenerate}
            leftIcon={<RefreshCw />}
            data-testid="generator-regenerate"
            className="bg-transparent"
          >
            Regenerate
          </Button>
          <Button size="sm" onClick={handleCopy} leftIcon={copied ? <Check /> : <Copy />} data-testid="generator-copy">
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span id="generator-length-label" className="text-sm font-semibold text-ink-2">
          Length
        </span>
        <div role="group" aria-labelledby="generator-length-label" className="flex flex-wrap gap-2">
          {PASSWORD_LENGTHS.map((length) => {
            const active = options.length === length;
            return (
              <button
                key={length}
                type="button"
                aria-pressed={active}
                data-testid={`length-option-${length}`}
                onClick={() => onOptionsChange({ ...options, length })}
                className={cn(
                  "h-11 min-w-14 rounded-lg border px-3.5 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  active
                    ? "border-accent bg-accent-soft font-bold text-accent-ink ring-1 ring-inset ring-accent"
                    : "border-line-strong bg-surface font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                {length}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span id="generator-include-label" className="text-sm font-semibold text-ink-2">
          Include
        </span>
        <div role="group" aria-labelledby="generator-include-label" className="grid grid-cols-2 gap-2">
          {CHARSET_KEYS.map((key) => {
            const on = options.sets[key];
            const locked = on && enabledCount === 1;
            const { label, sample } = CHARSET_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                aria-disabled={locked || undefined}
                title={locked ? "At least one character set must stay on" : undefined}
                data-testid={`charset-${key}`}
                onClick={() => toggleSet(key)}
                className={cn(
                  "flex min-h-[52px] min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  on ? "border-accent/40 bg-accent-soft/60" : "border-line bg-surface hover:bg-surface-2",
                  locked && "cursor-not-allowed"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-5 w-5 flex-none items-center justify-center rounded-md",
                    on ? "bg-accent text-on-accent" : "border-2 border-line-strong bg-surface"
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-ink">{label}</span>
                  <span className="font-mono text-xs text-muted">{sample(options.excludeAmbiguous)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {enabledCount === 1 && <p className="text-[13px] text-muted">At least one character set must stay on.</p>}
      </div>

      <Checkbox
        checked={options.excludeAmbiguous}
        onChange={(event) => onOptionsChange({ ...options, excludeAmbiguous: event.target.checked })}
        label="Exclude ambiguous characters"
        description={`Skips ${Array.from(AMBIGUOUS_CHARACTERS).join(" ")}, which look alike in many fonts.`}
        data-testid="exclude-ambiguous"
      />

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        leftIcon={<KeyRound />}
        onClick={() => setSaveOpen(true)}
        data-testid="save-as-credential"
      >
        Save as new credential
      </Button>

      <SaveCredentialModal open={saveOpen} onClose={() => setSaveOpen(false)} password={password} />
    </Card>
  );
}
