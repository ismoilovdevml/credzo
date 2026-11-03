import Link from "next/link";
import { Activity, Check, Cloud, Database, KeyRound, ShieldCheck, Terminal, type LucideIcon } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const HIGHLIGHTS = ["Runs in Docker", "Encrypted at rest", "Role-based access"];

export function Hero() {
  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,11fr)_minmax(0,12fr)] lg:gap-14 lg:pb-16 lg:pt-[88px]">
      <div className="flex min-w-0 flex-col gap-6">
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-ink">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Self-hosted credential vault for teams
        </span>
        <h1 className="text-balance text-[36px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[46px] lg:text-[56px] lg:leading-[1.06]">
          Every server, database and API key your team owns. One calm, encrypted place.
        </h1>
        <p className="max-w-[540px] text-[17px] leading-relaxed text-muted sm:text-[19px]">
          Credzo keeps infrastructure credentials organised by project and environment, shares them with exactly the
          right people, and records every reveal in an audit trail.
        </p>
        <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
          <Button asChild size="lg" className="rounded-xl px-6 text-base">
            <Link href="/signup" data-testid="hero-create-vault">
              Create your vault
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-xl px-6 text-base">
            <Link href="/login" data-testid="hero-see-dashboard">
              See the dashboard
            </Link>
          </Button>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-accent" strokeWidth={2.4} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <ProductPreview />
    </section>
  );
}

interface PreviewRow {
  name: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
  trailing: "masked" | "rotate" | "copied";
  active?: boolean;
}

/** Illustrative example data for the marketing mock-up; not real credentials. */
const PREVIEW_ROWS: PreviewRow[] = [
  {
    name: "payments-db-primary",
    detail: "postgres://pay_svc@10.0.4.12:5432",
    icon: Database,
    tone: "bg-info-soft text-info",
    trailing: "masked",
  },
  {
    name: "api-node-01",
    detail: "ubuntu@api-01.internal:22",
    icon: Terminal,
    tone: "bg-accent-soft text-accent-ink",
    trailing: "rotate",
  },
  {
    name: "stripe-secret-key",
    detail: "sk_live_51Hx…9aQe",
    icon: KeyRound,
    tone: "bg-violet-soft text-violet",
    trailing: "copied",
    active: true,
  },
  {
    name: "s3-invoices-bucket",
    detail: "eu-central-1 · AKIA…7Q2M",
    icon: Cloud,
    tone: "bg-warn-soft text-warn",
    trailing: "masked",
  },
];

/** Static product mock-up. Decorative only, so it is hidden from assistive technology. */
function ProductPreview() {
  return (
    <div
      aria-hidden="true"
      className="min-w-0 select-none overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_24px_60px_-24px_rgb(22_32_46/0.25)] dark:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)]"
    >
      <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3.5 sm:px-[18px]">
        <span className="truncate text-[15px] font-bold">Payments API</span>
        <Badge tone="danger">production</Badge>
        <span className="ml-auto whitespace-nowrap text-[13px] text-muted">12 credentials</span>
      </div>
      <ul>
        {PREVIEW_ROWS.map((row) => (
          <li
            key={row.name}
            className={cn(
              "grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line-soft px-4 py-3.5 last:border-b-0 sm:px-[18px]",
              row.active && "bg-accent-soft/40"
            )}
          >
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-[9px]", row.tone)}>
              <row.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{row.name}</div>
              <div className={cn("truncate font-mono text-[12.5px]", row.active ? "text-accent-ink" : "text-muted")}>
                {row.detail}
              </div>
            </div>
            <PreviewTrailing kind={row.trailing} />
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2.5 border-t border-line-soft bg-surface-2 px-4 py-3 text-[13px] text-muted sm:px-[18px]">
        <Activity className="h-[15px] w-[15px] flex-none" strokeWidth={1.8} />
        <span className="truncate">Dilnoza revealed stripe-secret-key · just now</span>
      </div>
    </div>
  );
}

function PreviewTrailing({ kind }: { kind: PreviewRow["trailing"] }) {
  if (kind === "rotate") return <Badge tone="warn">rotate in 3d</Badge>;
  if (kind === "copied") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-ink">
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
        Copied
      </span>
    );
  }
  return <span className="font-mono text-[13px] tracking-[0.1em] text-ink-2">••••••••••</span>;
}
