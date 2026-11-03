"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, Link2 } from "lucide-react";
import { Button, Checkbox, CopyButton, Field, IconButton, Input, SegmentedControl, Textarea } from "@/components/ui";
import { notify } from "@/components/Toast";
import { CLIPBOARD_CLEAR_MS } from "@/hooks/useClipboard";
import { MAX_SECRET_BYTES, encryptShare } from "@/lib/share-crypto";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { EXPIRY_OPTIONS, VIEW_OPTIONS, formatDateTime, pluralize, type ExpiryOption, type ViewOption } from "./format";

const MAX_LABEL_LENGTH = 120;
const MIN_PASSPHRASE_LENGTH = 8;

interface CreatedLink {
  url: string;
  expiresAt: string;
  expiresIn: ExpiryOption;
  maxViews: number;
  requiresPassphrase: boolean;
}

interface FormErrors {
  secret?: string;
  label?: string;
  passphrase?: string;
}

export interface ShareFormProps {
  /** Current generator output, offered as a one-click fill. */
  generatedPassword: string;
  /** Called after a link is created so the list can refresh. */
  onCreated: () => void;
}

function validate(secret: string, label: string, requirePassphrase: boolean, passphrase: string): FormErrors {
  const errors: FormErrors = {};
  if (!secret.trim()) errors.secret = "Enter the secret to share.";
  else if (new TextEncoder().encode(secret).length > MAX_SECRET_BYTES) errors.secret = "The secret is too large (max 64 KB).";
  if (label.trim().length > MAX_LABEL_LENGTH) errors.label = `Use at most ${MAX_LABEL_LENGTH} characters.`;
  if (requirePassphrase && passphrase.length < MIN_PASSPHRASE_LENGTH) {
    errors.passphrase = `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  }
  return errors;
}

/** Encrypts in the browser, stores only ciphertext, and shows the one-time link with its key in the fragment. */
export function ShareForm({ generatedPassword, onCreated }: ShareFormProps) {
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [views, setViews] = useState<ViewOption>("1");
  const [expiresIn, setExpiresIn] = useState<ExpiryOption>("24h");
  const [requirePassphrase, setRequirePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedLink | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(secret, label, requirePassphrase, passphrase);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const encrypted = await encryptShare(secret, requirePassphrase ? passphrase : undefined);
      const maxViews = Number(views);
      const share = await api.post<{ id: string; expiresAt: string }>("/api/shares", {
        label: label.trim() || undefined,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt ?? undefined,
        requiresPassphrase: requirePassphrase,
        maxViews,
        expiresIn,
      });
      setCreated({
        url: `${window.location.origin}/s/${share.id}#${encrypted.linkKey}`,
        expiresAt: share.expiresAt,
        expiresIn,
        maxViews,
        requiresPassphrase: requirePassphrase,
      });
      setSecret("");
      setPassphrase("");
      setShowPassphrase(false);
      onCreated();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        notify.error(errorMessage(error, "Couldn't create the link."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const expiryLabel = EXPIRY_OPTIONS.find((option) => option.value === created?.expiresIn)?.label;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-[18px]" aria-label="Create a one-time secure link">
      <Field
        label="Secret"
        id="share-secret"
        error={errors.secret}
        labelAction={
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setSecret(generatedPassword);
              setErrors((current) => ({ ...current, secret: undefined }));
            }}
            disabled={!generatedPassword}
            data-testid="share-use-generated"
          >
            Use generated password
          </Button>
        }
      >
        <Textarea
          mono
          rows={3}
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="Password, token, connection string…"
          autoComplete="off"
          spellCheck={false}
          data-testid="share-secret"
        />
      </Field>

      <Field label="Label" id="share-label" optional error={errors.label} hint="Only you see this, in your list of links.">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={MAX_LABEL_LENGTH}
          placeholder="e.g. VPN config for contractor"
          autoComplete="off"
          data-testid="share-label"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Expires after</span>
          <SegmentedControl
            aria-label="Expires after number of views"
            data-testid="share-views"
            value={views}
            onChange={setViews}
            options={VIEW_OPTIONS.map((option) => ({ ...option }))}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Or after</span>
          <SegmentedControl
            aria-label="Or after this much time"
            data-testid="share-expiry"
            value={expiresIn}
            onChange={setExpiresIn}
            options={EXPIRY_OPTIONS.map((option) => ({ ...option }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Checkbox
          checked={requirePassphrase}
          onChange={(event) => {
            setRequirePassphrase(event.target.checked);
            setErrors((current) => ({ ...current, passphrase: undefined }));
          }}
          label="Require a passphrase to open"
          description="Send the passphrase through a different channel than the link."
          data-testid="share-require-passphrase"
        />
        {requirePassphrase && (
          <Field label="Passphrase" id="share-passphrase" required error={errors.passphrase}>
            <Input
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="new-password"
              data-testid="share-passphrase"
              trailing={
                <IconButton
                  label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                  size="sm"
                  onClick={() => setShowPassphrase((value) => !value)}
                >
                  {showPassphrase ? <EyeOff /> : <Eye />}
                </IconButton>
              }
            />
          </Field>
        )}
      </div>

      <Button type="submit" size="lg" loading={submitting} leftIcon={<Link2 />} data-testid="create-link">
        Create link
      </Button>

      {created && (
        <div role="status" className="flex flex-col gap-2.5 rounded-xl border border-accent/30 bg-accent-soft/60 p-3.5">
          <span className="flex items-start gap-2 text-[14px] font-semibold text-accent-ink">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span title={`Expires ${formatDateTime(created.expiresAt)}`}>
              Link ready · expires in {expiryLabel} or after {pluralize(created.maxViews, "view")}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <code
              data-testid="share-link-output"
              className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-line-strong bg-surface px-3 py-2.5 font-mono text-[13px] text-ink"
            >
              {created.url}
            </code>
            <CopyButton
              value={created.url}
              label="Copy link"
              sensitive
              successMessage={`Link copied. Clipboard clears in ${CLIPBOARD_CLEAR_MS / 1000}s.`}
              data-testid="share-link-copy"
            />
          </div>
          <p className="text-[13px] text-muted">
            Copy it now: the key lives only in this link, so Credzo can&apos;t show it again.
            {created.requiresPassphrase && " Share the passphrase separately."}
          </p>
        </div>
      )}
    </form>
  );
}
