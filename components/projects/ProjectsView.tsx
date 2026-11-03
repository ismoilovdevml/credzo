"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, FolderPlus, Plus, RotateCw, Search, SearchX } from "lucide-react";
import type { ProjectSummary } from "@/lib/utils/projects";
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  EmptyState,
  Input,
  PageHeader,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { useSession } from "@/components/shell/SessionProvider";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { NewProjectTile, ProjectCard, ProjectCardSkeleton } from "./ProjectCard";
import { pluralize } from "./format";

type ScopeFilter = "all" | "organization" | "personal";
type SortKey = "updated" | "name" | "credentials";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; projects: ProjectSummary[]; loadedAt: number };

const SORT_LABEL: Record<SortKey, string> = {
  updated: "Recently updated",
  name: "Name",
  credentials: "Most credentials",
};

const SEARCH_DEBOUNCE_MS = 250;
const SKELETON_COUNT = 6;
const ENV_KEYS = ["production", "staging", "development"] as const;
const gridClass = "grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]";

function compareProjects(sort: SortKey) {
  return (a: ProjectSummary, b: ProjectSummary): number => {
    if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (sort === "credentials" && a.credentialCount !== b.credentialCount) return b.credentialCount - a.credentialCount;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  };
}

function matchesQuery(project: ProjectSummary, term: string): boolean {
  return project.name.toLowerCase().includes(term) || project.description.toLowerCase().includes(term);
}

function headerSummary(projects: ProjectSummary[]): string {
  const credentials = projects.reduce((sum, project) => sum + project.credentialCount, 0);
  const environments = ENV_KEYS.filter((key) => projects.some((project) => project.environments[key] > 0)).length;
  const base = `${pluralize(projects.length, "project")} · ${pluralize(credentials, "credential")}`;
  return environments > 0 ? `${base} across ${pluralize(environments, "environment")}` : base;
}

function ProjectsGridSkeleton() {
  return (
    <div className={gridClass} aria-busy="true" aria-label="Loading projects" data-testid="projects-loading">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Suspense fallback while search params resolve. */
export function ProjectsPageFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full max-w-[420px] rounded-lg" />
      <ProjectsGridSkeleton />
    </div>
  );
}

export function ProjectsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSession();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<ScopeFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");

  // The search box mirrors ?q= (the top bar navigates here with it). `written` is the last
  // value this page pushed to the URL, so its own updates are not mistaken for navigation.
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  const [written, setWritten] = useState(urlQuery);
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== written) {
      setQuery(urlQuery);
      setWritten(urlQuery);
    }
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const writeQueryToUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(window.location.search);
      const term = value.trim();
      if (term) params.set("q", term);
      else params.delete("q");
      setWritten(term);
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => writeQueryToUrl(value), SEARCH_DEBOUNCE_MS);
  };

  const clearFilters = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery("");
    setFilter("all");
    writeQueryToUrl("");
  };

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<ProjectSummary[]>("/api/projects", { signal: controller.signal })
      .then((projects) => setState({ status: "ready", projects, loadedAt: Date.now() }))
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof ApiError && error.status === 401)) return;
        setState({ status: "error", message: errorMessage(error, "Couldn't reach the server.") });
      });
    return () => controller.abort();
  }, [reloadKey]);

  const retry = () => {
    setState({ status: "loading" });
    setReloadKey((key) => key + 1);
  };

  const projects = useMemo(() => (state.status === "ready" ? state.projects : []), [state]);

  const counts = useMemo(() => {
    const personal = projects.filter((project) => project.organizationId === null).length;
    return { all: projects.length, organization: projects.length - personal, personal };
  }, [projects]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (filter === "personal" && project.organizationId !== null) return false;
        if (filter === "organization" && project.organizationId === null) return false;
        return term ? matchesQuery(project, term) : true;
      })
      .sort(compareProjects(sort));
  }, [projects, query, filter, sort]);

  const newProjectButton = (
    <Button asChild leftIcon={<Plus aria-hidden="true" />} data-testid="new-project-button">
      <Link href="/dashboard/projects/new">New project</Link>
    </Button>
  );

  const description =
    state.status === "ready"
      ? headerSummary(projects)
      : state.status === "loading"
        ? "Loading projects…"
        : "Credentials grouped by project.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Projects" description={description} actions={newProjectButton} />

      {state.status !== "error" && !(state.status === "ready" && projects.length === 0) && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-[1_1_280px] sm:max-w-[420px]">
            <label htmlFor="projects-search" className="sr-only">
              Search projects
            </label>
            <Input
              id="projects-search"
              type="search"
              placeholder="Search projects"
              autoComplete="off"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              leading={<Search />}
              data-testid="projects-search"
            />
          </div>
          <SegmentedControl<ScopeFilter>
            aria-label="Filter projects"
            data-testid="projects-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: state.status === "ready" ? counts.all : undefined },
              {
                value: "organization",
                label: "Organisation",
                count: state.status === "ready" ? counts.organization : undefined,
              },
              { value: "personal", label: "Personal", count: state.status === "ready" ? counts.personal : undefined },
            ]}
          />
          <div className="flex-1 max-sm:hidden" aria-hidden="true" />
          <DropdownMenu
            label="Sort projects"
            trigger={
              <Button variant="secondary" className="font-medium text-ink-2" data-testid="projects-sort">
                <span>
                  Sort: <span className="text-ink">{SORT_LABEL[sort]}</span>
                </span>
                <ChevronDown aria-hidden="true" />
              </Button>
            }
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onSelect={() => setSort(key)}
                trailing={
                  key === sort ? (
                    <>
                      <Check className="h-4 w-4 text-accent-ink" aria-hidden="true" />
                      <span className="sr-only">(selected)</span>
                    </>
                  ) : undefined
                }
              >
                {SORT_LABEL[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenu>
        </div>
      )}

      {state.status === "loading" && <ProjectsGridSkeleton />}

      {state.status === "error" && (
        <EmptyState
          icon={<AlertTriangle />}
          title="Couldn't load projects"
          description={state.message}
          action={
            <Button variant="secondary" leftIcon={<RotateCw aria-hidden="true" />} onClick={retry}>
              Try again
            </Button>
          }
          data-testid="projects-error"
          role="alert"
        />
      )}

      {state.status === "ready" && projects.length === 0 && (
        <EmptyState
          icon={<FolderPlus />}
          title="No projects yet"
          description="Projects group the credentials for a service or team. Create your first one, or import an existing vault from JSON in Settings."
          action={
            <>
              <Button asChild leftIcon={<Plus aria-hidden="true" />}>
                <Link href="/dashboard/projects/new">Create a project</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard/settings">Import from JSON</Link>
              </Button>
            </>
          }
          data-testid="projects-empty"
        />
      )}

      {state.status === "ready" && projects.length > 0 && visible.length === 0 && (
        <EmptyState
          icon={<SearchX />}
          title="No matching projects"
          description={
            query.trim()
              ? `Nothing matches “${query.trim()}”${filter === "all" ? "" : " with the current filter"}.`
              : "No projects match the current filter."
          }
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear search and filters
            </Button>
          }
          data-testid="projects-no-results"
        />
      )}

      {state.status === "ready" && visible.length > 0 && (
        <>
          <p className="sr-only" aria-live="polite">
            {pluralize(visible.length, "project")} shown
          </p>
          <ul className={gridClass} data-testid="projects-grid" aria-label="Projects">
            {visible.map((project) => (
              <li key={project.id} className="flex min-w-0 [&>a]:min-w-0 [&>a]:flex-1">
                <ProjectCard
                  project={project}
                  now={state.loadedAt}
                  currentUserId={user?.id ?? null}
                />
              </li>
            ))}
            <li className="flex min-w-0 [&>a]:min-w-0 [&>a]:flex-1">
              <NewProjectTile />
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
