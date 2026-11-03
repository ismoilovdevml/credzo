"use client";

import { useEffect, useEffectEvent, useState, type FormEvent } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button, Checkbox, CopyButton, Field, Input, Modal, Skeleton } from "@/components/ui";
import { notify } from "@/components/Toast";
import { ApiError, api } from "@/lib/api-client";
import { errorMessage } from "./api";
import { PasswordInput } from "./controls";
import { downloadFile, isoDay } from "./format";

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
}

const groupSecret = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;
const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 6);

/**
 * Enable two-factor: fetch a fresh secret, verify a 6-digit code, then show the
 * ten backup codes once. `onEnabled` fires as soon as the server turns 2FA on.
 */
export function EnableTwoFactorModal({
  open,
  onClose,
  onEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onEnabled: () => void;
}) {
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const onAlreadyEnabled = useEffectEvent(() => {
    notify.info("Two-factor authentication is already on");
    onEnabled();
    onClose();
  });

  // A new secret is issued each time the dialog opens (or the user retries after an error).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.post<SetupResponse>("/api/account/2fa/setup", {})
      .then((data) => {
        if (!cancelled) setSetup(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 409) onAlreadyEnabled();
        else setSetupError(errorMessage(error, "Couldn't start two-factor setup"));
      });
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  const reset = () => {
    setSetup(null);
    setSetupError(null);
    setCode("");
    setCodeError(null);
    setBackupCodes(null);
    setSaved(false);
  };

  const close = () => {
    if (verifying || (backupCodes && !saved)) return;
    reset();
    onClose();
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) {
      setCodeError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setVerifying(true);
    try {
      const result = await api.post<{ backupCodes: string[] }>("/api/account/2fa/enable", { code });
      setBackupCodes(result.backupCodes);
      onEnabled();
    } catch (error) {
      const message = errorMessage(error, "Couldn't verify the code");
      if (error instanceof ApiError && error.status === 400) setCodeError(message);
      else notify.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const codesText = backupCodes?.join("\n") ?? "";
  const downloadCodes = () => {
    const body = [
      "Credzo two-factor backup codes",
      `Generated ${new Date().toISOString()}`,
      "Each code works once. Keep them somewhere safe.",
      "",
      codesText,
      "",
    ].join("\n");
    downloadFile(body, `credzo-backup-codes-${isoDay()}.txt`, "text/plain;charset=utf-8");
  };

  if (backupCodes) {
    return (
      <Modal
        open={open}
        onClose={close}
        dismissible={saved}
        title="Save your backup codes"
        description="Each code signs you in once if you lose your phone. They won't be shown again."
        footer={
          <Button data-testid="backup-codes-done" disabled={!saved} onClick={close}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <ol
            data-testid="backup-codes"
            className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-line bg-surface-2 p-4 font-mono text-[14px] text-ink"
          >
            {backupCodes.map((backupCode) => (
              <li key={backupCode} className="select-all tracking-wide">
                {backupCode}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              variant="button"
              size="sm"
              value={codesText}
              label="Copy all"
              sensitive
              successMessage="Backup codes copied"
            />
            <Button variant="secondary" size="sm" leftIcon={<Download />} onClick={downloadCodes}>
              Download .txt
            </Button>
          </div>
          <Checkbox
            data-testid="backup-codes-saved"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
            label="I saved these codes somewhere safe"
          />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!verifying}
      title="Turn on two-factor authentication"
      description="Add Credzo to an authenticator app such as 1Password, Google Authenticator or Authy."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={verifying}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="twofa-enable-form"
            loading={verifying}
            disabled={!setup}
            data-testid="twofa-confirm"
          >
            Verify and turn on
          </Button>
        </>
      }
    >
      {setupError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-[14px] text-danger">{setupError}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSetupError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <form id="twofa-enable-form" onSubmit={verify} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-semibold text-ink-2">1. Add this setup key to your app</p>
            {setup ? (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 py-2 pl-4 pr-2">
                <code data-testid="twofa-secret" className="min-w-0 flex-1 break-all font-mono text-[15px] tracking-wide text-ink">
                  {groupSecret(setup.secret)}
                </code>
                <CopyButton value={setup.secret} label="Copy setup key" sensitive successMessage="Setup key copied" />
              </div>
            ) : (
              <Skeleton className="h-[52px] w-full rounded-xl" />
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              {setup && (
                <a
                  href={setup.otpauthUrl}
                  className="inline-flex items-center gap-1 font-semibold text-accent-ink underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Open in authenticator app
                </a>
              )}
              <span>No QR code here — enter the key manually or open the link on this device.</span>
            </div>
          </div>
          <Field label="2. Enter the 6-digit code it shows" error={codeError}>
            <Input
              data-testid="twofa-code"
              value={code}
              onChange={(event) => {
                setCode(digitsOnly(event.target.value));
                setCodeError(null);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              mono
              className="max-w-[180px] tracking-[0.3em]"
              disabled={!setup}
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}

/** Disable two-factor: requires the account password and a current code (or an unused backup code). */
export function DisableTwoFactorModal({
  open,
  onClose,
  onDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onDisabled: () => void;
}) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ password?: string; code?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPassword("");
    setCode("");
    setErrors({});
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (!password) found.password = "Enter your password";
    if (!code.trim()) found.code = "Enter a code from your app or a backup code";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await api.post("/api/account/2fa/disable", { password, code: code.trim() });
      notify.success("Two-factor authentication turned off");
      setSubmitting(false);
      reset();
      onDisabled();
      onClose();
    } catch (error) {
      const message = errorMessage(error, "Couldn't turn off two-factor authentication");
      if (error instanceof ApiError && /password/i.test(message)) setErrors({ password: message });
      else if (error instanceof ApiError && /code/i.test(message)) setErrors({ code: message });
      else notify.error(message);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!submitting}
      role="alertdialog"
      size="sm"
      title="Turn off two-factor authentication"
      description="Your account will be protected by your password only."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="twofa-disable-form"
            variant="danger"
            loading={submitting}
            data-testid="twofa-disable-submit"
          >
            Turn off
          </Button>
        </>
      }
    >
      <form id="twofa-disable-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Password" error={errors.password}>
          <PasswordInput
            data-testid="twofa-disable-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field
          label="Verification code"
          error={errors.code}
          hint="6-digit code from your app, or a backup code (xxxxx-xxxxx)."
        >
          <Input
            data-testid="twofa-disable-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            mono
          />
        </Field>
      </form>
    </Modal>
  );
}
