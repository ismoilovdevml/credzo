"use client";

import { Eye, EyeOff } from "lucide-react";
import { notify } from "@/components/Toast";
import { CopyButton, IconButton, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/api-client";
import { getServiceMetadata } from "@/lib/services";
import type { ServiceType } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const MASK = "••••••••••••";

export interface FieldEntry {
  name: string;
  label: string;
  secret: boolean;
  multiline: boolean;
  /** Plain value of a non-secret field. */
  value?: string;
}

/** "authSource" → "Auth source", "api_key" → "Api key". */
function humanize(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Fields that hold a value, in the order and with the labels of the service
 * definition; fields the definition doesn't know (custom/legacy) follow.
 */
export function buildFieldEntries(type: string, fields: Record<string, string>, secretFields: string[]): FieldEntry[] {
  const definitions = getServiceMetadata(type as ServiceType)?.fields ?? [];
  const secrets = new Set(secretFields);
  const present = (name: string) => secrets.has(name) || Boolean(fields[name]);
  const entry = (name: string, label: string, multiline: boolean): FieldEntry => ({
    name,
    label,
    secret: secrets.has(name),
    multiline,
    value: secrets.has(name) ? undefined : fields[name],
  });

  const known = new Set(definitions.map((field) => field.name));
  const ordered = definitions
    .filter((field) => present(field.name))
    .map((field) => entry(field.name, field.label, field.type === "textarea"));
  const extra = [...Object.keys(fields), ...secretFields]
    .filter((name, index, all) => !known.has(name) && all.indexOf(name) === index && present(name))
    .map((name) => entry(name, humanize(name), false));

  return [...ordered, ...extra];
}

const ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]";
const LABEL = "col-span-2 text-[13.5px] font-medium text-muted sm:col-span-1";
const VALUE = "m-0 min-w-0 font-mono text-[14px] text-ink";

interface SecretState {
  values: Record<string, string> | null;
  revealed: ReadonlySet<string>;
  pending: string | null;
  reveal: (name: string) => Promise<void>;
  hide: (name: string) => void;
  getSecret: (name: string) => Promise<string>;
}

export interface FieldListProps {
  entries: FieldEntry[];
  secrets: SecretState;
}

/** Definition list of a credential's fields: plain values with copy, secrets masked with reveal + copy. */
export function FieldList({ entries, secrets }: FieldListProps) {
  return (
    <dl className="m-0 overflow-hidden rounded-2xl border border-line bg-surface">
      {entries.map((entry) => {
        const lower = entry.label.toLowerCase();
        const multiline = entry.multiline && "max-h-60 overflow-auto whitespace-pre-wrap";

        if (!entry.secret) {
          return (
            <div key={entry.name} data-testid={`field-${entry.name}`} className={cn(ROW, "border-b border-line-soft last:border-b-0")}>
              <dt className={LABEL}>{entry.label}</dt>
              <dd className={cn(VALUE, "break-words", multiline)}>{entry.value}</dd>
              <CopyButton value={entry.value ?? ""} label={`Copy ${lower}`} data-testid={`copy-${entry.name}`} />
            </div>
          );
        }

        const shown = secrets.revealed.has(entry.name);
        const loading = secrets.pending === entry.name;
        const value = secrets.values?.[entry.name];
        const toggle = () => {
          if (shown) {
            secrets.hide(entry.name);
            return;
          }
          secrets.reveal(entry.name).catch((error: unknown) => {
            notify.error(errorMessage(error, `Couldn't reveal the ${lower}`));
          });
        };

        return (
          <div
            key={entry.name}
            data-testid={`field-${entry.name}`}
            className={cn(ROW, "border-b border-line-soft bg-accent-soft/40 last:border-b-0")}
          >
            <dt className={LABEL}>{entry.label}</dt>
            <dd className={cn(VALUE, "break-all", shown ? multiline : "select-none tracking-[0.08em] text-ink-2")}>
              {shown ? (
                (value ?? <span className="font-sans text-muted">Not set</span>)
              ) : (
                <>
                  <span aria-hidden="true">{MASK}</span>
                  <span className="sr-only">{`${entry.label} hidden`}</span>
                </>
              )}
            </dd>
            <div className="flex items-center">
              <IconButton
                label={shown ? `Hide ${lower}` : `Reveal ${lower}`}
                aria-pressed={shown}
                onClick={toggle}
                disabled={loading}
                data-testid={`reveal-${entry.name}`}
                className="text-accent-ink"
              >
                {loading ? <Spinner className="h-4 w-4" /> : shown ? <EyeOff /> : <Eye />}
              </IconButton>
              <CopyButton
                value={() => secrets.getSecret(entry.name)}
                label={`Copy ${lower}`}
                sensitive
                className="text-accent-ink"
                data-testid={`copy-${entry.name}`}
              />
            </div>
          </div>
        );
      })}
    </dl>
  );
}
