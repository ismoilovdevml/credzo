"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, FolderPlus, Search } from "lucide-react";
import type { ProjectSummary } from "@/lib/utils/projects";
import { Avatar, Badge, Button, EmptyState, Input, Modal, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { apiRequest, errorMessage } from "./api";
import { pluralize } from "./format";

/** Show a filter box once the list gets long. */
const SEARCH_THRESHOLD = 6;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; projects: ProjectSummary[] };

export interface SaveCredentialModalProps {
  open: boolean;
  onClose: () => void;
  password: string;
}

/** Pick a writable project, then continue to its new-credential form with the password prefilled. */
export function SaveCredentialModal({ open, onClose, password }: SaveCredentialModalProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiRequest<ProjectSummary[]>("/api/projects")
      .then((projects) => {
        if (!cancelled) setState({ status: "ready", projects });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: errorMessage(error, "Couldn't load your projects.") });
      });
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  const allProjects = state.status === "ready" ? state.projects : [];
  const writable = useMemo(
    () => allProjects.filter((project) => project.currentUserRole === "owner" || project.currentUserRole === "editor"),
    [allProjects]
  );
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? writable.filter((project) => project.name.toLowerCase().includes(term)) : writable;
  }, [writable, query]);
  const selected = writable.find((project) => project.id === selectedId) ?? null;

  const handleContinue = () => {
    if (!selected) return;
    const params = new URLSearchParams({ password });
    router.push(`/dashboard/projects/${encodeURIComponent(selected.id)}/credentials/new?${params.toString()}`);
  };

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  let body;
  if (state.status === "loading") {
    body = (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading projects">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-[60px] w-full rounded-lg" />
        ))}
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-danger-soft p-4 text-[14px] text-danger">
        <span className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {state.message}
        </span>
        <Button variant="secondary" size="sm" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  } else if (writable.length === 0) {
    body = (
      <EmptyState
        bare
        icon={<FolderPlus />}
        title={allProjects.length === 0 ? "No projects yet" : "No projects you can edit"}
        description={
          allProjects.length === 0
            ? "Create a project first, then save the password into it."
            : "You have read-only access to your projects. Ask an owner for editor access."
        }
        action={
          allProjects.length === 0 ? (
            <Button asChild size="sm">
              <Link href="/dashboard/projects/new">New project</Link>
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {writable.length > SEARCH_THRESHOLD && (
          <Input
            type="search"
            inputSize="sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter projects"
            aria-label="Filter projects"
            leading={<Search />}
          />
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Project</legend>
          {visible.map((project) => {
            const checked = project.id === selectedId;
            return (
              <label
                key={project.id}
                data-testid="save-project-option"
                className={cn(
                  "flex min-h-[60px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50",
                  checked ? "border-accent bg-accent-soft/60" : "border-line hover:bg-surface-2"
                )}
              >
                <input
                  type="radio"
                  name="save-project"
                  value={project.id}
                  checked={checked}
                  onChange={() => setSelectedId(project.id)}
                  className="sr-only"
                />
                <Avatar name={project.name} shape="square" size="sm" decorative />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14.5px] font-semibold text-ink">{project.name}</span>
                  <span className="text-[13px] text-muted">{pluralize(project.credentialCount, "credential")}</span>
                </span>
                <Badge tone={project.currentUserRole === "owner" ? "accent" : "neutral"} size="sm">
                  {project.currentUserRole === "owner" ? "Owner" : "Editor"}
                </Badge>
              </label>
            );
          })}
          {visible.length === 0 && <p className="py-4 text-center text-[14px] text-muted">No projects match “{query.trim()}”.</p>}
        </fieldset>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as new credential"
      description="Choose a project. The generated password is filled in on the next screen."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={!selected} data-testid="save-credential-continue">
            Continue
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
