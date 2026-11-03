import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

interface Rule {
  label: string;
  met: boolean;
}

interface Strength {
  /** 0 (empty) to 4 bars. */
  score: number;
  label: string;
  barClass: string;
  textClass: string;
  rules: Rule[];
}

const LEVELS = [
  { label: "", barClass: "", textClass: "" },
  { label: "Weak", barClass: "bg-danger", textClass: "text-danger" },
  { label: "Fair", barClass: "bg-warn", textClass: "text-warn" },
  { label: "Good", barClass: "bg-accent", textClass: "text-accent-ink" },
  { label: "Strong", barClass: "bg-success", textClass: "text-success" },
] as const;

export function measurePassword(password: string): Strength {
  const longEnough = password.length >= PASSWORD_MIN_LENGTH;
  const mixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (password.length > 0) {
    score = longEnough
      ? Math.min(4, 1 + Number(mixedCase) + Number(hasNumber) + Number(hasSymbol || password.length >= 16))
      : 1;
  }

  const level = LEVELS[score];
  return {
    score,
    label: password.length > 0 && !longEnough ? "Too short" : level.label,
    barClass: level.barClass,
    textClass: level.textClass,
    rules: [
      { label: `${PASSWORD_MIN_LENGTH}+ characters (required)`, met: longEnough },
      { label: "Upper & lower case", met: mixedCase },
      { label: "A number", met: hasNumber },
      { label: "A symbol", met: hasSymbol },
    ],
  };
}

/** Four-bar strength meter plus the requirement checklist. `id` is referenced by the input's aria-describedby. */
export function PasswordStrength({ password, id }: { password: string; id: string }) {
  const strength = measurePassword(password);
  return (
    <div id={id} className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((bar) => (
            <span
              key={bar}
              className={cn("h-[5px] rounded-full transition-colors", bar <= strength.score ? strength.barClass : "bg-line")}
            />
          ))}
        </div>
        <span className={cn("min-w-[64px] text-right text-[13px] font-semibold", strength.textClass)} aria-live="polite">
          {strength.label && <span className="sr-only">Password strength: </span>}
          {strength.label}
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
        {strength.rules.map((rule) => (
          <li key={rule.label} className={cn("flex items-center gap-1.5", rule.met ? "text-ink-2" : "text-muted")}>
            {rule.met ? (
              <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted" strokeWidth={2.2} aria-hidden="true" />
            )}
            {rule.label}
            <span className="sr-only">{rule.met ? " — met" : " — not met"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
