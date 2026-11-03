"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { ServiceIcon } from "@/components/ServiceIcon";
import { Input } from "@/components/ui";
import { SERVICE_DEFINITIONS, getServicesByCategory } from "@/lib/services";
import type { ServiceMetadata, ServiceType } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const POPULAR = "Popular";

const POPULAR_TYPES: ServiceType[] = [
  "postgresql",
  "ssh-server",
  "aws",
  "api-key",
  "mysql",
  "redis",
  "mongodb",
  "kubernetes",
  "vm-server",
  "github-actions",
  "smtp",
  "gcp",
];

const SERVICES_BY_CATEGORY = getServicesByCategory();
const CATEGORIES = [POPULAR, ...Object.keys(SERVICES_BY_CATEGORY)];
const POPULAR_SERVICES = POPULAR_TYPES.flatMap((type) => SERVICE_DEFINITIONS.filter((service) => service.type === type));

/** Icon tile colours per category (semantic tokens, so dark mode follows). */
const CATEGORY_TONES: Record<string, string> = {
  Servers: "bg-accent-soft text-accent-ink",
  Database: "bg-info-soft text-info",
  Caching: "bg-info-soft text-info",
  Cloud: "bg-warn-soft text-warn",
  Storage: "bg-warn-soft text-warn",
  Authentication: "bg-violet-soft text-violet",
  Communication: "bg-violet-soft text-violet",
};
const DEFAULT_TONE = "bg-track text-ink-2";

export function categoryTone(category: string): string {
  return CATEGORY_TONES[category] ?? DEFAULT_TONE;
}

interface ServicePickerProps {
  selected: ServiceType | null;
  onSelect: (type: ServiceType) => void;
}

/** Step 1 of the new-credential form: browse by category or search every service. */
export function ServicePicker({ selected, onSelect }: ServicePickerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(POPULAR);
  const term = query.trim().toLowerCase();

  const services = useMemo<ServiceMetadata[]>(() => {
    if (term) {
      return SERVICE_DEFINITIONS.filter(
        (service) =>
          service.label.toLowerCase().includes(term) ||
          service.type.includes(term) ||
          service.category.toLowerCase().includes(term)
      );
    }
    return category === POPULAR ? POPULAR_SERVICES : (SERVICES_BY_CATEGORY[category] ?? []);
  }, [term, category]);

  const chooseCategory = (next: string) => {
    setCategory(next);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${SERVICE_DEFINITIONS.length} services`}
        aria-label="Search services"
        leading={<Search />}
        data-testid="service-search"
      />

      <div role="group" aria-label="Service category" className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((name) => {
          const active = !term && name === category;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => chooseCategory(name)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                active ? "bg-ink font-semibold text-surface" : "bg-track font-medium text-ink-2 hover:bg-ink/[0.08] hover:text-ink"
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {term ? `${services.length} services match "${query.trim()}"` : ""}
      </p>

      {services.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-10 text-center">
          <SearchX className="h-6 w-6 text-muted" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">No services match &ldquo;{query.trim()}&rdquo;</p>
          <p className="text-[13px] text-muted">
            Try another name, or use <span className="font-semibold text-ink-2">Generic Credential</span> under Other.
          </p>
        </div>
      ) : (
        <ul
          aria-label="Services"
          className="-m-1 grid max-h-[460px] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 overflow-y-auto p-1"
        >
          {services.map((service) => {
            const active = service.type === selected;
            return (
              <li key={service.type} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(service.type)}
                  title={service.label}
                  data-testid={`service-option-${service.type}`}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-2.5 rounded-xl border bg-surface p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                    active ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line hover:border-line-strong hover:bg-surface-2"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]",
                      categoryTone(service.category)
                    )}
                    aria-hidden="true"
                  >
                    <ServiceIcon type={service.type} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-ink">{service.label}</span>
                    <span className="truncate text-xs text-muted">{service.category}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
