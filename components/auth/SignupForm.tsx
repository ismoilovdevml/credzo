"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button, Field, Input, Label } from "@/components/ui";
import { REGEX_PATTERNS } from "@/lib/config/constants";
import { FormError } from "./FormError";
import { PasswordInput } from "./PasswordInput";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PasswordStrength } from "./PasswordStrength";
import { NETWORK_ERROR_MESSAGE, postAuth, rateLimitMessage, type AuthResponse } from "./auth-api";

const NAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 254;
const USERNAME_HINT = "3–32 characters: letters, numbers and underscores.";

type FieldName = "firstName" | "lastName" | "username" | "email" | "password" | "confirm";
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;

/** Order used to focus the first invalid control on submit. */
const FIELD_ORDER: FieldName[] = ["firstName", "lastName", "username", "email", "password", "confirm"];

const EMPTY: Values = { firstName: "", lastName: "", username: "", email: "", password: "", confirm: "" };

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.firstName.trim()) errors.firstName = "Enter your first name.";
  if (!values.lastName.trim()) errors.lastName = "Enter your last name.";

  const username = values.username.trim();
  if (!username) errors.username = "Choose a username.";
  else if (username.length < 3 || username.length > 32 || !REGEX_PATTERNS.USERNAME.test(username)) {
    errors.username = "Use 3–32 letters, numbers or underscores.";
  }

  const email = values.email.trim();
  if (!email) errors.email = "Enter your email address.";
  else if (!REGEX_PATTERNS.EMAIL.test(email)) errors.email = "Enter a valid email address.";

  if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!values.confirm) errors.confirm = "Repeat your password.";
  else if (values.confirm !== values.password) errors.confirm = "Passwords don't match.";
  return errors;
}

/** Maps a 409 message from the API to the field it is about. */
function conflictField(message: string): FieldName | null {
  const lower = message.toLowerCase();
  if (lower.includes("username")) return "username";
  if (lower.includes("email")) return "email";
  return null;
}

export function SignupForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clientErrors = validate(values);
  const errorFor = (name: FieldName) => serverErrors[name] ?? (touched[name] ? clientErrors[name] : undefined);

  const bind = (name: FieldName) => ({
    name,
    value: values[name],
    disabled: loading,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setValues((prev) => ({ ...prev, [name]: value }));
      if (serverErrors[name]) setServerErrors((prev) => ({ ...prev, [name]: undefined }));
    },
    onBlur: () => setTouched((prev) => ({ ...prev, [name]: true })),
  });

  const focusField = (name: FieldName) => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const firstInvalid = FIELD_ORDER.find((name) => clientErrors[name]);
    if (firstInvalid) {
      setTouched(Object.fromEntries(FIELD_ORDER.map((name) => [name, true])));
      focusField(firstInvalid);
      return;
    }

    setLoading(true);
    let result: AuthResponse<{ success: boolean }>;
    try {
      result = await postAuth<{ success: boolean }>("/api/auth/signup", {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      setLoading(false);
      return;
    }

    if (result.ok && result.data?.success) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    const message = result.data?.error ?? "Couldn't create your account. Please try again.";
    if (result.status === 429) {
      setError(rateLimitMessage(result.retryAfterSeconds));
    } else if (result.status === 409) {
      setError(message);
      const field = conflictField(message);
      if (field) {
        setServerErrors({ [field]: field === "username" ? "This username is taken." : "This email is already registered." });
        focusField(field);
      }
    } else {
      setError(message);
    }
    setLoading(false);
  };

  const passwordError = errorFor("password");

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full max-w-[520px] flex-col gap-[22px] rounded-[20px] border border-line bg-surface p-6 shadow-card sm:p-9"
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ink">Create your account</h1>
        <p className="text-[15px] text-muted">
          Already have one?{" "}
          <Link
            href="/login"
            className="rounded font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Sign in
          </Link>
        </p>
      </div>

      {error && <FormError message={error} testId="signup-error" />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="signup-first-name" label="First name" error={errorFor("firstName")}>
          <Input
            {...bind("firstName")}
            inputSize="lg"
            autoComplete="given-name"
            autoFocus
            required
            maxLength={NAME_MAX_LENGTH}
            data-testid="signup-first-name"
          />
        </Field>
        <Field id="signup-last-name" label="Last name" error={errorFor("lastName")}>
          <Input
            {...bind("lastName")}
            inputSize="lg"
            autoComplete="family-name"
            required
            maxLength={NAME_MAX_LENGTH}
            data-testid="signup-last-name"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="signup-username" label="Username" hint={USERNAME_HINT} error={errorFor("username")}>
          <Input
            {...bind("username")}
            inputSize="lg"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={32}
            data-testid="signup-username"
          />
        </Field>
        <Field id="signup-email" label="Work email" error={errorFor("email")}>
          <Input
            {...bind("email")}
            inputSize="lg"
            type="email"
            autoComplete="email"
            required
            maxLength={EMAIL_MAX_LENGTH}
            placeholder="you@company.com"
            data-testid="signup-email"
          />
        </Field>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordInput
          {...bind("password")}
          id="signup-password"
          inputSize="lg"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          invalid={Boolean(passwordError)}
          aria-required
          aria-describedby={passwordError ? "signup-password-error signup-password-strength" : "signup-password-strength"}
          data-testid="signup-password"
        />
        {passwordError && (
          <p id="signup-password-error" className="flex items-start gap-1.5 text-[13px] font-medium text-danger">
            <AlertCircle className="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" />
            {passwordError}
          </p>
        )}
        <PasswordStrength id="signup-password-strength" password={values.password} />
      </div>

      <Field id="signup-confirm" label="Confirm password" error={errorFor("confirm")}>
        <PasswordInput
          {...bind("confirm")}
          inputSize="lg"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          data-testid="signup-confirm"
        />
      </Field>

      <Button type="submit" size="lg" loading={loading} className="h-[50px] w-full text-base" data-testid="signup-submit">
        {loading ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-[13px] text-muted">
        The first account on a new installation becomes the platform admin.
      </p>
    </form>
  );
}
