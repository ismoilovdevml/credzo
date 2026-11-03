"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import {
  ACTION_GROUPS,
  RESOURCE_TYPES,
  actionLabel,
  parseDay,
  resourceLabel,
  type AuditFilters as Filters,
  type Person,
} from "./audit-model";

const SEARCH_DEBOUNCE_MS = 300;

export interface AuditFiltersProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  people: Person[];
  /** Label for a `user` filter that is not in `people` (e.g. a deep link to a former member). */
  selectedUserLabel?: string;
}

export function AuditFilters({ filters, onChange, onClear, people, selectedUserLabel }: AuditFiltersProps) {
  // Local draft so typing stays responsive; the URL is updated after a short pause.
  const [draft, setDraft] = useState(filters.search);
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    setDraft(filters.search);
  }

  useEffect(() => {
    const next = draft.trim();
    if (next === filters.search) return;
    const timer = setTimeout(() => onChange({ search: next }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, filters.search, onChange]);

  const knownActions = new Set(ACTION_GROUPS.flatMap((group) => group.actions));
  const userInList = !filters.user || people.some((person) => person.id === filters.user);
  // ISO dates compare correctly as strings.
  const rangeInvalid = Boolean(parseDay(filters.from) && parseDay(filters.to) && filters.from > filters.to);
  const active = Object.values(filters).some(Boolean) || draft.trim() !== "";

  return (
    <section
      aria-label="Filters"
      className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <Field label="Search" id="audit-search" className="col-span-full sm:col-span-2">
        <Input
          type="search"
          inputSize="sm"
          placeholder="Credential, person or IP"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onChange({ search: draft.trim() });
          }}
          leading={<Search />}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          data-testid="audit-search"
        />
      </Field>

      <Field label="Person" id="audit-user">
        <Select
          inputSize="sm"
          value={filters.user}
          onChange={(event) => onChange({ user: event.target.value })}
          data-testid="audit-filter-user"
        >
          <option value="">Everyone</option>
          {!userInList && <option value={filters.user}>{selectedUserLabel ?? "Selected user"}</option>}
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Action" id="audit-action">
        <Select
          inputSize="sm"
          value={filters.action}
          onChange={(event) => onChange({ action: event.target.value })}
          data-testid="audit-filter-action"
        >
          <option value="">All actions</option>
          {filters.action && !knownActions.has(filters.action) && (
            <option value={filters.action}>{actionLabel(filters.action)}</option>
          )}
          {ACTION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.actions.map((action) => (
                <option key={action} value={action}>
                  {actionLabel(action)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <Field label="Resource" id="audit-resource">
        <Select
          inputSize="sm"
          value={filters.resource}
          onChange={(event) => onChange({ resource: event.target.value })}
          data-testid="audit-filter-resource"
        >
          <option value="">All resources</option>
          {filters.resource && !RESOURCE_TYPES.includes(filters.resource) && (
            <option value={filters.resource}>{resourceLabel(filters.resource)}</option>
          )}
          {RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {resourceLabel(type)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="From" id="audit-from">
        <Input
          type="date"
          inputSize="sm"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
          data-testid="audit-filter-from"
        />
      </Field>

      <Field label="To" id="audit-to" error={rangeInvalid ? "Must be on or after the start date" : undefined}>
        <Input
          type="date"
          inputSize="sm"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => onChange({ to: event.target.value })}
          data-testid="audit-filter-to"
        />
      </Field>

      {active && (
        <div className="col-span-full flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<X />}
            onClick={() => {
              setDraft("");
              onClear();
            }}
            data-testid="audit-clear-filters"
          >
            Clear filters
          </Button>
        </div>
      )}
    </section>
  );
}
