"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Plus, Search, SearchX } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { notify } from "@/components/Toast";
import { Button, EmptyState, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { apiRequest, errorMessage } from "./api";
import { CredentialsTable } from "./CredentialsTable";
import {
  ENVIRONMENT_TABS,
  countByEnvironment,
  serviceLabel,
  type CredentialView,
  type EnvironmentFilter,
} from "./model";

interface CredentialsPanelProps {
  projectId: string;
  credentials: CredentialView[];
  canEdit: boolean;
  now: number;
  onDeleted: (credentialId: string) => void;
}

function matchesQuery(credential: CredentialView, needle: string): boolean {
  const haystack = [
    credential.name,
    credential.description,
    credential.type,
    serviceLabel(credential.type),
    ...credential.linkedServers,
    ...Object.values(credential.fields),
  ];
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

export function CredentialsPanel({ projectId, credentials, canEdit, now, onDeleted }: CredentialsPanelProps) {
  const [environment, setEnvironment] = useState<EnvironmentFilter>("all");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  // The target outlives the open flag so the dialog text stays stable while it animates out.
  const [pendingDelete, setPendingDelete] = useState<CredentialView | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const counts = useMemo(() => countByEnvironment(credentials), [credentials]);

  const types = useMemo(
    () =>
      [...new Set(credentials.map((credential) => credential.type))]
        .map((value) => ({ value, label: serviceLabel(value) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [credentials]
  );
  const activeType = types.some((option) => option.value === type) ? type : "all";

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return credentials
      .filter((credential) => environment === "all" || credential.environment === environment)
      .filter((credential) => activeType === "all" || credential.type === activeType)
      .filter((credential) => !needle || matchesQuery(credential, needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [credentials, environment, activeType, query]);

  const clearFilters = () => {
    setEnvironment("all");
    setQuery("");
    setType("all");
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await apiRequest(`/api/credentials/${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" });
      onDeleted(pendingDelete.id);
      notify.success(`Deleted "${pendingDelete.name}"`);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't delete the credential"));
    }
  };

  const addHref = `/dashboard/projects/${encodeURIComponent(projectId)}/credentials/new`;

  return (
    <section aria-label="Credentials" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter by environment" className="flex max-w-full flex-wrap gap-1 rounded-lg bg-track p-1">
          {ENVIRONMENT_TABS.map((tab) => {
            const active = tab.value === environment;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => setEnvironment(tab.value)}
                data-testid={`env-tab-${tab.value}`}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  active ? "bg-surface font-semibold text-ink shadow-pill dark:bg-line" : "font-medium text-ink-2 hover:text-ink"
                )}
              >
                {tab.label}
                <span className="font-medium text-muted">{counts[tab.value]}</span>
              </button>
            );
          })}
        </div>
        <div className="min-w-0 flex-[1_1_220px]">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, host or type"
            aria-label="Search credentials"
            leading={<Search />}
            data-testid="credential-search"
          />
        </div>
        {types.length > 1 && (
          <Select
            value={activeType}
            onChange={(event) => setType(event.target.value)}
            aria-label="Filter by type"
            className="w-auto min-w-[160px] flex-[0_1_200px]"
          >
            <option value="all">All types</option>
            {types.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {credentials.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title="No credentials yet"
          description={
            canEdit
              ? "Store database logins, SSH keys, API tokens and other secrets for this project."
              : "Nothing has been added to this project yet."
          }
          action={
            canEdit && (
              <Button asChild leftIcon={<Plus />}>
                <Link href={addHref}>Add credential</Link>
              </Button>
            )
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No matching credentials"
          description={
            query.trim() || activeType !== "all"
              ? "Try a different search or clear the filters."
              : "No credentials in this environment yet."
          }
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <CredentialsTable
          credentials={visible}
          canEdit={canEdit}
          now={now}
          onDelete={(credential) => {
            setPendingDelete(credential);
            setConfirmOpen(true);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete credential?"
        message={`"${pendingDelete?.name ?? ""}" and its secret values will be permanently deleted. This can't be undone.`}
        confirmText="Delete credential"
        variant="danger"
      />
    </section>
  );
}
