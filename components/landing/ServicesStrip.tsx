import { SERVICE_DEFINITIONS } from "@/lib/services";
import type { ServiceMetadata, ServiceType } from "@/lib/types";

/** Well-known services shown by name; everything else is summarised as "+ N more". */
const FEATURED: ServiceType[] = [
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "ssh-server",
  "kubernetes",
  "kafka",
  "aws",
  "gcp",
  "github-actions",
  "grafana",
  "vault",
  "minio",
  "smtp",
  "ldap",
];

const featured = FEATURED.map((type) => SERVICE_DEFINITIONS.find((service) => service.type === type)).filter(
  (service): service is ServiceMetadata => service !== undefined
);
const total = SERVICE_DEFINITIONS.length;
const remaining = total - featured.length;
/** Rounded down to a multiple of ten, so the headline never overstates the catalogue. */
const headlineCount = total >= 20 ? `${Math.floor(total / 10) * 10}+` : String(total);

export function ServicesStrip() {
  return (
    <section id="services" aria-labelledby="services-heading" className="scroll-mt-20 border-y border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-4 py-10 sm:px-6">
        <h2
          id="services-heading"
          className="text-center text-sm font-semibold uppercase tracking-[0.08em] text-muted"
        >
          Ready-made forms for {headlineCount} services
        </h2>
        <ul className="flex flex-wrap justify-center gap-2.5" data-testid="landing-services-list">
          {featured.map((service) => (
            <li
              key={service.type}
              className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink-2"
              data-testid="service-chip"
            >
              {service.label}
            </li>
          ))}
          {remaining > 0 && (
            <li className="rounded-lg bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent-ink">
              + {remaining} more
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
