"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, Checkbox, Field, Input } from "@/components/ui";
import { FormError } from "./FormError";
import { PasswordInput } from "./PasswordInput";
import { TwoFactorStep } from "./TwoFactorStep";
import { NETWORK_ERROR_MESSAGE, postAuth, rateLimitMessage, safeNextPath, type AuthResponse } from "./auth-api";

const INVALID_CREDENTIALS_MESSAGE = "Incorrect username, email or password.";

type LoginResponse = { success: boolean; requiresTwoFactor?: boolean; challenge?: string };

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);

  const finish = () => {
    router.replace(safeNextPath(next) ?? "/dashboard");
    router.refresh();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    let result: AuthResponse<LoginResponse>;
    try {
      result = await postAuth<LoginResponse>("/api/auth/login", {
        username: identifier.trim(),
        password,
        remember,
      });
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      setLoading(false);
      return;
    }

    if (result.ok && result.data?.success) {
      if (result.data.requiresTwoFactor && result.data.challenge) {
        setChallenge(result.data.challenge);
        setLoading(false);
        return;
      }
      // Keep the button busy until the dashboard replaces this page.
      finish();
      return;
    }

    if (result.status === 401) setError(INVALID_CREDENTIALS_MESSAGE);
    else if (result.status === 429) setError(rateLimitMessage(result.retryAfterSeconds));
    else setError(result.data?.error ?? "Sign-in failed. Please try again.");
    setLoading(false);
  };

  if (challenge) {
    return (
      <TwoFactorStep
        challenge={challenge}
        onSuccess={finish}
        onBack={() => {
          setChallenge(null);
          setPassword("");
          setError(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-[400px] flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ink">Sign in</h1>
        <p className="text-[15px] text-muted">
          No account yet?{" "}
          <Link href="/signup" className="rounded font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            Create one
          </Link>
        </p>
      </div>

      {error && <FormError message={error} testId="login-error" />}

      <Field id="login-identifier" label="Username or email">
        <Input
          inputSize="lg"
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          maxLength={254}
          placeholder="you@company.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={loading}
          data-testid="login-username"
        />
      </Field>

      <Field id="login-password" label="Password">
        <PasswordInput
          inputSize="lg"
          name="password"
          autoComplete="current-password"
          required
          maxLength={256}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          data-testid="login-password"
        />
      </Field>

      <Checkbox
        label="Keep me signed in for 7 days"
        checked={remember}
        onChange={(e) => setRemember(e.target.checked)}
        disabled={loading}
        className="min-h-[44px] items-center text-[14.5px]"
        data-testid="login-remember"
      />

      <Button type="submit" size="lg" loading={loading} className="h-[50px] w-full text-base" data-testid="login-submit">
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <div className="flex items-center gap-3 text-[13px] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        then
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex items-start gap-3.5 rounded-xl border border-line bg-surface p-4">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-accent-soft text-accent-ink">
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[14.5px] font-semibold text-ink">Two-factor step</p>
          <p className="text-[14px] leading-normal text-muted">
            If 2FA is on, you&rsquo;ll enter a 6-digit code from your authenticator app next.
          </p>
        </div>
      </div>
    </form>
  );
}
