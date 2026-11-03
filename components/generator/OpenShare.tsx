"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, Clock, Eye, EyeOff, KeyRound, Link2Off, LockKeyhole, ShieldCheck, ShieldX, Unlock } from "lucide-react";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Button, Card, CopyButton, Field, IconButton, Input, Logo, Skeleton } from "@/components/ui";
import { useIsClient } from "@/hooks/useIsClient";
import { ShareDecryptError, decryptShare, parseLinkKey } from "@/lib/share-crypto";
import { cn } from "@/lib/utils/cn";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatTimeLeft, pluralize, useNow } from "./format";

type UnavailableReason = "not_found" | "expired" | "revoked" | "consumed";

type ShareMeta =
  | { exists: true; requiresPassphrase: boolean; expiresAt: string; viewsLeft: number }
  | { exists: false; reason: UnavailableReason };

interface OpenPayload {
  ciphertext: string;
  iv: string;
  salt: string | null;
  requiresPassphrase: boolean;
  viewsLeft: number;
}

type ViewState =
  | { kind: "checking" }
  | { kind: "missing-key" }
  | { kind: "unavailable"; reason: UnavailableReason }
  | { kind: "error"; message: string }
  | { kind: "ready"; requiresPassphrase: boolean; expiresAt: string; viewsLeft: number }
  /** The view was consumed but the passphrase was wrong; the ciphertext stays in memory for local retries. */
  | { kind: "locked"; payload: OpenPayload }
  | { kind: "corrupt" }
  | { kind: "revealed"; secret: string; viewsLeft: number };

const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const UNAVAILABLE_REASONS: readonly string[] = ["not_found", "expired", "revoked", "consumed"];

const UNAVAILABLE_COPY: Record<UnavailableReason, { title: string; description: string }> = {
  not_found: {
    title: "Link not found",
    description: "This link doesn't exist. Check that you copied the whole link, or ask the sender for a new one.",
  },
  expired: {
    title: "This link has expired",
    description: "The secret was deleted when the link expired. Ask the sender to create a new link.",
  },
  revoked: {
    title: "This link was revoked",
    description: "The sender revoked the link and the secret was deleted. Ask them for a new link if you still need it.",
  },
  consumed: {
    title: "Already viewed",
    description:
      "This secret has already been opened and was deleted from the server. If it wasn't you who opened it, tell the sender — someone else may have seen it.",
  },
};

function isUnavailableReason(value: unknown): value is UnavailableReason {
  return typeof value === "string" && UNAVAILABLE_REASONS.includes(value);
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return error.retryAfter
      ? `Too many attempts. Try again in ${pluralize(error.retryAfter, "second")}.`
      : "Too many attempts. Try again shortly.";
  }
  return errorMessage(error);
}

/** Public page for a one-time link: checks status, reveals on explicit request and decrypts locally. */
export function OpenShare({ id }: { id: string }) {
  const isClient = useIsClient();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo href="/" size="sm" />
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:items-center sm:pt-0">
        <Card className="w-full max-w-[480px] p-6 shadow-pop sm:p-8">
          {isClient ? <OpenShareFlow id={id} /> : <FlowSkeleton />}
        </Card>
      </main>
      <footer className="flex items-center justify-center gap-1.5 px-4 pb-6 text-center text-[12.5px] text-muted">
        <ShieldCheck className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        End-to-end encrypted. Decryption happens in your browser.
      </footer>
    </div>
  );
}

function FlowSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Checking link">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function OpenShareFlow({ id }: { id: string }) {
  const now = useNow();
  // The key never leaves the browser: fragments are not sent with HTTP requests.
  const [linkKey] = useState(() => parseLinkKey(window.location.hash));
  const [state, setState] = useState<ViewState>(() =>
    !linkKey ? { kind: "missing-key" } : SHARE_ID_PATTERN.test(id) ? { kind: "checking" } : { kind: "unavailable", reason: "not_found" }
  );
  const [metaAttempt, setMetaAttempt] = useState(0);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const checking = state.kind === "checking";
  useEffect(() => {
    if (!checking) return;
    let cancelled = false;
    api.get<ShareMeta>(`/api/shares/${encodeURIComponent(id)}/meta`, { redirectOn401: false })
      .then((meta) => {
        if (cancelled) return;
        setState(
          meta.exists
            ? { kind: "ready", requiresPassphrase: meta.requiresPassphrase, expiresAt: meta.expiresAt, viewsLeft: meta.viewsLeft }
            : { kind: "unavailable", reason: meta.reason }
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: "error", message: requestErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [checking, id, metaAttempt]);

  // Leaving after a wrong passphrase loses the only copy of the ciphertext.
  const locked = state.kind === "locked";
  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [locked]);

  const decrypt = async (payload: OpenPayload) => {
    if (!linkKey) return;
    try {
      const secret = await decryptShare(payload, linkKey, payload.requiresPassphrase ? passphrase : null);
      setPassphrase("");
      setState({ kind: "revealed", secret, viewsLeft: payload.viewsLeft });
    } catch (error) {
      if (!(error instanceof ShareDecryptError)) throw error;
      if (payload.requiresPassphrase) {
        setPassphraseError("Wrong passphrase. Check it with the sender and try again.");
        setState({ kind: "locked", payload });
      } else {
        setState({ kind: "corrupt" });
      }
    }
  };

  const handleReveal = async (event: FormEvent) => {
    event.preventDefault();
    if (state.kind !== "ready" && state.kind !== "locked") return;
    const requiresPassphrase = state.kind === "ready" ? state.requiresPassphrase : state.payload.requiresPassphrase;
    if (requiresPassphrase && !passphrase) {
      setPassphraseError("Enter the passphrase the sender gave you.");
      return;
    }
    setPassphraseError(null);
    setBusy(true);
    try {
      if (state.kind === "locked") {
        await decrypt(state.payload);
        return;
      }
      const payload = await api.post<OpenPayload>(`/api/shares/${encodeURIComponent(id)}/open`, undefined, {
        redirectOn401: false,
      });
      await decrypt(payload);
    } catch (error) {
      if (error instanceof ApiError && isUnavailableReason(error.code)) {
        setState({ kind: "unavailable", reason: error.code });
      } else {
        setState({ kind: "error", message: requestErrorMessage(error) });
      }
    } finally {
      setBusy(false);
    }
  };

  switch (state.kind) {
    case "checking":
      return <FlowSkeleton />;

    case "missing-key":
      return (
        <StatusMessage
          tone="warn"
          icon={<Link2Off />}
          title="This link is incomplete"
          testId="share-missing-key"
          description="The decryption key (the part after # in the link) is missing or damaged. Ask the sender to send the full link again. Nothing has been opened."
        />
      );

    case "unavailable": {
      const copy = UNAVAILABLE_COPY[state.reason];
      return (
        <StatusMessage
          tone={state.reason === "not_found" ? "warn" : "muted"}
          icon={state.reason === "expired" ? <Clock /> : state.reason === "consumed" ? <Eye /> : <ShieldX />}
          title={copy.title}
          description={copy.description}
          testId={`share-unavailable-${state.reason}`}
        />
      );
    }

    case "error":
      return (
        <StatusMessage
          tone="danger"
          icon={<AlertTriangle />}
          title="Something went wrong"
          testId="share-error"
          description={state.message}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setState({ kind: "checking" });
                setMetaAttempt((value) => value + 1);
              }}
            >
              Check the link again
            </Button>
          }
        />
      );

    case "corrupt":
      return (
        <StatusMessage
          tone="danger"
          icon={<ShieldX />}
          title="The secret couldn't be decrypted"
          testId="share-decrypt-failed"
          description="The link looks altered or incomplete, so its key doesn't match. The view was used. Ask the sender for a new link."
        />
      );

    case "revealed":
      return (
        <div className="flex flex-col gap-5">
          <Heading icon={<Unlock />} tone="accent" title="Here's your secret" />
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 rounded-xl border border-line-strong bg-surface-2 p-3">
              <pre
                data-testid="revealed-secret"
                className={cn(
                  "min-h-[44px] min-w-0 flex-1 whitespace-pre-wrap break-all px-1 py-1.5 font-mono text-[14.5px] leading-relaxed text-ink",
                  hidden && "select-none blur-[6px]"
                )}
                aria-hidden={hidden || undefined}
              >
                {state.secret}
              </pre>
              <IconButton
                label={hidden ? "Show secret" : "Hide secret"}
                size="md"
                onClick={() => setHidden((value) => !value)}
              >
                {hidden ? <Eye /> : <EyeOff />}
              </IconButton>
            </div>
            <CopyButton value={state.secret} variant="button" sensitive label="Copy secret" className="w-full sm:w-auto sm:self-start" />
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted">
            {state.viewsLeft === 0
              ? "This was the last view: the secret has been deleted from the server. Save it somewhere safe before you close this page."
              : `This link can be opened ${pluralize(state.viewsLeft, "more time")}. Close this page when you're done.`}
          </p>
        </div>
      );

    case "ready":
    case "locked": {
      const isLocked = state.kind === "locked";
      const requiresPassphrase = isLocked ? true : state.requiresPassphrase;
      const lastView = !isLocked && state.viewsLeft <= 1;
      return (
        <form noValidate onSubmit={handleReveal} className="flex flex-col gap-5">
          <Heading
            icon={<LockKeyhole />}
            tone="accent"
            title={isLocked ? "Enter the passphrase again" : "Someone shared a secret with you"}
            description={
              isLocked
                ? "The encrypted secret is loaded on this page. Retry the passphrase here; it can't be fetched again."
                : "It's encrypted end to end: Credzo stores only scrambled data and never sees the key."
            }
          />

          {!isLocked && (
            <ul className="flex flex-col gap-2 rounded-xl bg-surface-2 p-4 text-[14px] text-ink-2">
              <li className="flex items-start gap-2.5">
                <Eye className="mt-0.5 h-4 w-4 flex-none text-muted" aria-hidden="true" />
                {lastView
                  ? "Revealing it uses the last view. It's deleted from the server right after."
                  : `Revealing it uses 1 of ${state.viewsLeft} remaining views.`}
              </li>
              <li className="flex items-start gap-2.5" title={formatDateTime(state.expiresAt)}>
                <Clock className="mt-0.5 h-4 w-4 flex-none text-muted" aria-hidden="true" />
                Link expires in {formatTimeLeft(state.expiresAt, now).replace(/ left$/, "")}.
              </li>
              {requiresPassphrase && (
                <li className="flex items-start gap-2.5">
                  <KeyRound className="mt-0.5 h-4 w-4 flex-none text-muted" aria-hidden="true" />
                  You need the passphrase the sender gave you separately.
                </li>
              )}
            </ul>
          )}

          {requiresPassphrase && (
            <Field label="Passphrase" id="share-open-passphrase" required error={passphraseError ?? undefined}>
              <Input
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="off"
                autoFocus={isLocked}
                data-testid="share-open-passphrase"
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

          {requiresPassphrase && !isLocked && (
            <p
              data-testid="share-passphrase-warning"
              className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2.5 text-[13.5px] leading-relaxed text-warn"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              Revealing uses a view even if the passphrase is wrong. You can retry on this page, but not after leaving
              or reloading it.
            </p>
          )}

          <Button type="submit" size="lg" loading={busy} leftIcon={<Unlock />} data-testid="reveal-secret">
            {isLocked ? "Try passphrase" : "Reveal secret"}
          </Button>
        </form>
      );
    }
  }
}

const TONES = {
  accent: "bg-accent-soft text-accent-ink",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  muted: "bg-surface-2 text-muted",
} as const;

function Heading({
  icon,
  tone,
  title,
  description,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl [&_svg]:h-6 [&_svg]:w-6", TONES[tone])} aria-hidden="true">
        {icon}
      </span>
      <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
      {description && <p className="text-[14.5px] leading-relaxed text-muted">{description}</p>}
    </div>
  );
}

function StatusMessage({
  icon,
  tone,
  title,
  description,
  action,
  testId,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  title: string;
  description: string;
  action?: ReactNode;
  testId: string;
}) {
  return (
    <div role="status" data-testid={testId} className="flex flex-col gap-5">
      <Heading icon={icon} tone={tone} title={title} description={description} />
      {action}
    </div>
  );
}
