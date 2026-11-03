"use client";

import { useState, type FormEvent } from "react";
import { Button, Field, Modal } from "@/components/ui";
import { notify } from "@/components/Toast";
import { ApiError, api } from "@/lib/api-client";
import { errorMessage } from "./api";
import { PasswordInput, StrengthMeter } from "./controls";

const MIN_LENGTH = 10;
const MAX_LENGTH = 256;

interface ChangePasswordResult {
  passwordChangedAt: string | null;
  revokedSessions: number;
}

type Errors = Partial<Record<"current" | "next" | "confirm", string>>;

/** Change password: current + new (≥10, strength meter) + confirm. Other sessions are signed out by the server. */
export function ChangePasswordModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: (result: ChangePasswordResult) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    if (!current) found.current = "Enter your current password";
    if (next.length < MIN_LENGTH) found.next = `Use at least ${MIN_LENGTH} characters`;
    else if (next.length > MAX_LENGTH) found.next = `Use at most ${MAX_LENGTH} characters`;
    else if (next === current) found.next = "Choose a password different from the current one";
    if (!found.next && confirm !== next) found.confirm = "Passwords don't match";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const result = await api.post<ChangePasswordResult>("/api/user-password", {
        currentPassword: current,
        newPassword: next,
      });
      const others = result.revokedSessions;
      notify.success(
        others > 0
          ? `Password changed. ${others} other ${others === 1 ? "session was" : "sessions were"} signed out.`
          : "Password changed. Any other sessions were signed out."
      );
      onChanged(result);
      setSubmitting(false);
      setCurrent("");
      setNext("");
      setConfirm("");
      onClose();
    } catch (error) {
      const message = errorMessage(error, "Couldn't change your password");
      if (error instanceof ApiError && /current password/i.test(message)) setErrors({ current: message });
      else if (error instanceof ApiError && /new password/i.test(message)) setErrors({ next: message });
      else notify.error(message);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!submitting}
      title="Change password"
      description="You'll stay signed in here. Every other session will be signed out."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="change-password-form" loading={submitting} data-testid="change-password-submit">
            Change password
          </Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Current password" error={errors.current}>
          <PasswordInput
            data-testid="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            maxLength={MAX_LENGTH}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <Field label="New password" error={errors.next} hint={`At least ${MIN_LENGTH} characters. A long passphrase works well.`}>
            <PasswordInput
              data-testid="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              maxLength={MAX_LENGTH}
            />
          </Field>
          <StrengthMeter password={next} />
        </div>
        <Field label="Confirm new password" error={errors.confirm}>
          <PasswordInput
            data-testid="confirm-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            maxLength={MAX_LENGTH}
          />
        </Field>
      </form>
    </Modal>
  );
}
