"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  absoluteTime,
  actionLabel,
  actionTone,
  dayKey,
  dayLabel,
  describeEvent,
  relativeTime,
  resourceLabel,
  type AuditEvent,
} from "./audit-model";

export interface AuditEventListProps {
  events: AuditEvent[];
  actorFor: (event: AuditEvent) => string;
  /** Current time in ms, for relative timestamps. */
  now: number;
}

/** Events grouped by local day, newest first (the API already sorts them). */
export function AuditEventList({ events, actorFor, now }: AuditEventListProps) {
  const groups: { key: number; label: string; events: AuditEvent[] }[] = [];
  for (const event of events) {
    const key = dayKey(event.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.events.push(event);
    else groups.push({ key, label: dayLabel(event.timestamp, now), events: [event] });
  }

  return (
    <div data-testid="audit-list">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h2 className="border-b border-line-soft bg-surface-2 px-5 py-2.5 text-[13px] font-bold text-ink-2">{group.label}</h2>
          <ul>
            {group.events.map((event) => (
              <AuditEventRow key={event.id} event={event} actor={actorFor(event)} now={now} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AuditEventRow({ event, actor, now }: { event: AuditEvent; actor: string; now: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const sentence = describeEvent(event);
  const details = event.details && Object.keys(event.details).length > 0 ? JSON.stringify(event.details, null, 2) : null;

  return (
    <li className="border-b border-line-soft" data-testid="audit-row" data-action={event.action}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
        <time
          dateTime={event.timestamp}
          title={absoluteTime(event.timestamp)}
          className="w-[84px] flex-none whitespace-nowrap font-mono text-[12.5px] text-muted"
        >
          {relativeTime(event.timestamp, now)}
        </time>
        <span className="min-w-[104px] flex-none">
          <Badge tone={actionTone(event.action)}>{actionLabel(event.action)}</Badge>
        </span>
        <p className="flex min-w-0 flex-[1_1_300px] items-start gap-2.5 text-[14.5px] leading-[1.45]">
          <Avatar name={actor} size="xs" className="mt-px" />
          <span className="min-w-0 break-words">
            <strong className="font-semibold text-ink">
              {actor}
              {sentence.possessive && "’s"}
            </strong>{" "}
            <span className="text-ink-2">{sentence.verb}</span>
            {sentence.target && (
              <>
                {" "}
                <span className="break-all font-mono text-[13px] text-ink">{sentence.target}</span>
              </>
            )}
            {sentence.suffix && <span className="text-ink-2"> {sentence.suffix}</span>}
          </span>
        </p>
        <span className="text-[13px] text-muted">{resourceLabel(event.resourceType)}</span>
        <span className="min-w-[110px] flex-1 whitespace-nowrap font-mono text-[12.5px] text-muted sm:flex-none sm:text-right">
          {event.ipAddress ?? "—"}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Hide event details" : "Show event details"}
          title={open ? "Hide details" : "Details"}
          onClick={() => setOpen((value) => !value)}
          className="-mr-1 inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          data-testid="audit-row-toggle"
        >
          <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div id={panelId} className="animate-fade-in px-4 pb-4 sm:px-5" data-testid="audit-row-details">
          <div className="rounded-xl border border-line-soft bg-surface-2 p-4">
            <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-[max-content_1fr]">
              <DetailItem label="Event ID" value={event.id} />
              <DetailItem label="Time (UTC)" value={event.timestamp} />
              <DetailItem label="Actor ID" value={event.userId || "—"} />
              <DetailItem
                label="Resource"
                value={`${resourceLabel(event.resourceType)}${event.resourceId ? ` · ${event.resourceId}` : ""}`}
              />
              {event.userAgent && <DetailItem label="User agent" value={event.userAgent} />}
            </dl>
            {details ? (
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line-soft bg-surface p-3 font-mono text-[12.5px] leading-relaxed text-ink-2">
                {details}
              </pre>
            ) : (
              <p className="mt-3 text-[13px] text-muted">No additional details were recorded.</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 break-all font-mono text-[12.5px] text-ink-2">{value}</dd>
    </>
  );
}
