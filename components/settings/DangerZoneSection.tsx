"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button, Card, Field, Input, Modal } from "@/components/ui";
import { notify } from "@/components/Toast";
import { useSession } from "@/components/shell/SessionProvider";
import { ApiError, api } from "@/lib/api-client";
import { errorMessage } from "./api";
import { PasswordInput } from "./controls";

const CONFIRM_WORD = "DELETE";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "Delete all my data": removes personal projects and their credentials after password + typed confirmation. */
export function DangerZoneSection() {
  const router = useRouter();
  const { refreshProjectCount } = useSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPassword("");
    setTyped("");
    setPasswordError(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    setOpen(false);
  };

  const confirmed = typed === CONFIRM_WORD && password.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed) return;
    setBusy(true);
    try {
      const result = await api.del<{ projects: number; credentials: number }>("/api/account/data", { body: { password } });
      notify.success(`Deleted ${plural(result.projects, "project")} and ${plural(result.credentials, "credential")}`);
      await refreshProjectCount();
      reset();
      setOpen(false);
      router.push("/dashboard");
    } catch (error) {
      const message = errorMessage(error, "Couldn't delete your data");
      if (error instanceof ApiError && error.status === 400) setPasswordError(message);
      else notify.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-wrap items-center gap-3 border-danger/30 p-5 sm:p-6">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
        <h2 className="text-[17px] font-bold leading-snug tracking-tight text-danger">
          Delete all my data
        </h2>
        <p className="text-[14px] text-muted">
          Permanently removes your personal projects and credentials. Organisation projects stay.
        </p>
      </div>
      <Button
        variant="secondary"
        className="border-danger text-danger hover:border-danger hover:bg-danger-soft"
        data-testid="delete-data-button"
        onClick={() => setOpen(true)}
      >
        Delete data…
      </Button>

      <Modal
        open={open}
        onClose={close}
        dismissible={!busy}
        role="alertdialog"
        size="sm"
        title="Delete all your data?"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="delete-data-form"
              variant="danger"
              loading={busy}
              disabled={!confirmed}
              data-testid="delete-data-submit"
            >
              Delete my data
            </Button>
          </>
        }
      >
        <form id="delete-data-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-danger-soft p-3.5 text-[14px] leading-relaxed text-ink-2">
            <AlertTriangle className="mt-0.5 h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <p>
                This permanently deletes your <strong className="text-ink">personal projects</strong> and every credential
                in them. It can&apos;t be undone — export a backup first if you might need them.
              </p>
              <p>
                Projects in an organisation shared with other people stay, and so does your account.
              </p>
            </div>
          </div>
          <Field label="Password" error={passwordError}>
            <PasswordInput
              data-testid="delete-data-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(null);
              }}
              autoComplete="current-password"
            />
          </Field>
          <Field label={<>Type <span className="font-mono text-danger">{CONFIRM_WORD}</span> to confirm</>}>
            <Input
              data-testid="delete-data-confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              mono
            />
          </Field>
        </form>
      </Modal>
    </Card>
  );
}
