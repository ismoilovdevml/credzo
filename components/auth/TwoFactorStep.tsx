"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { FormError } from "./FormError";
import { NETWORK_ERROR_MESSAGE, postAuth, rateLimitMessage, type AuthResponse } from "./auth-api";

const TOTP_LENGTH = 6;
/** Backup codes are 10 characters shown as "xxxxx-xxxxx". */
const BACKUP_LENGTH = 10;

function formatTotp(value: string): string {
  return value.replace(/\D/g, "").slice(0, TOTP_LENGTH);
}

function formatBackupCode(value: string): string {
  const raw = value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, BACKUP_LENGTH);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
}

function isComplete(code: string, useBackup: boolean): boolean {
  return useBackup ? code.replace("-", "").length === BACKUP_LENGTH : code.length === TOTP_LENGTH;
}

export interface TwoFactorStepProps {
  challenge: string;
  onSuccess: () => void;
  onBack: () => void;
}

/** Second sign-in step: authenticator code (auto-submits at 6 digits) or a one-time backup code. */
export function TwoFactorStep({ challenge, onSuccess, onBack }: TwoFactorStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (value: string) => {
    if (loading || !isComplete(value, useBackup)) return;
    setError(null);
    setLoading(true);

    let result: AuthResponse<{ success: boolean }>;
    try {
      result = await postAuth<{ success: boolean }>("/api/auth/login/2fa", { challenge, code: value });
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      setLoading(false);
      return;
    }

    if (result.ok && result.data?.success) {
      onSuccess();
      return;
    }

    if (result.status === 429) setError(rateLimitMessage(result.retryAfterSeconds));
    else setError(result.data?.error ?? "Verification failed. Please try again.");
    setCode("");
    setLoading(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleChange = (value: string) => {
    const next = useBackup ? formatBackupCode(value) : formatTotp(value);
    setCode(next);
    if (!useBackup && next.length === TOTP_LENGTH) void verify(next);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void verify(code);
  };

  const toggleMode = () => {
    setUseBackup((v) => !v);
    setCode("");
    setError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-[400px] flex-col gap-[22px]">
      <div className="flex flex-col gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          {useBackup ? <KeyRound className="h-5 w-5" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ink">Two-factor authentication</h1>
          <p className="text-[15px] leading-normal text-muted">
            {useBackup
              ? "Enter one of the backup codes you saved when you turned on 2FA. Each code works once."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
        </div>
      </div>

      {error && <FormError message={error} testId="login-error" />}

      <Field id="twofa-code" label={useBackup ? "Backup code" : "Authentication code"}>
        {useBackup ? (
          <Input
            ref={inputRef}
            key="backup"
            inputSize="lg"
            mono
            type="text"
            name="backup-code"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            placeholder="xxxxx-xxxxx"
            maxLength={BACKUP_LENGTH + 1}
            value={code}
            onChange={(e) => handleChange(e.target.value)}
            disabled={loading}
            className="text-center text-[18px] tracking-[0.12em]"
            data-testid="twofa-code"
          />
        ) : (
          <Input
            ref={inputRef}
            key="totp"
            inputSize="lg"
            mono
            type="text"
            name="totp"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            maxLength={TOTP_LENGTH}
            value={code}
            onChange={(e) => handleChange(e.target.value)}
            disabled={loading}
            className="text-center text-[22px] tracking-[0.5em]"
            data-testid="twofa-code"
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={loading}
        disabled={!isComplete(code, useBackup)}
        className="h-[50px] w-full text-base"
        data-testid="twofa-submit"
      >
        {loading ? "Verifying…" : "Verify"}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft />} onClick={onBack} disabled={loading} className="-ml-3">
          Back to sign in
        </Button>
        <Button variant="link" size="sm" onClick={toggleMode} disabled={loading} data-testid="twofa-use-backup">
          {useBackup ? "Use authenticator app" : "Use a backup code instead"}
        </Button>
      </div>
    </form>
  );
}
