import Link from "next/link";
import { Building2, KeyRound, Lock, Plus, User, Users } from "lucide-react";
import type { ProjectSummary } from "@/lib/utils/projects";
import { Avatar, Badge, Skeleton, envTone, type BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { formatUpdated, pluralize } from "./format";

const ROLE_TONE: Record<ProjectSummary["currentUserRole"], BadgeTone> = {
  owner: "accent",
  editor: "info",
  viewer: "neutral",
};

const ROLE_LABEL: Record<ProjectSummary["currentUserRole"], string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

const ENV_SEGMENTS = [
  { key: "production", bar: "bg-danger" },
  { key: "staging", bar: "bg-warn" },
  { key: "development", bar: "bg-info" },
  { key: "unassigned", bar: "bg-muted/40" },
] as const;

const cardClass =
  "rounded-2xl border border-line bg-surface p-5 shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export interface ProjectCardProps {
  project: ProjectSummary;
  /** Reference time for the "updated" label (captured when the list loaded). */
  now: number;
  currentUserId: string | null;
}

function EnvironmentBreakdown({ environments, total }: { environments: ProjectSummary["environments"]; total: number }) {
  if (total === 0) {
    return <p className="text-[13px] text-muted">No credentials yet</p>;
  }
  const segments = ENV_SEGMENTS.filter(({ key }) => environments[key] > 0);
  return (
    <div className="flex flex-col gap-2.5">
      <div aria-hidden="true" className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-track">
        {segments.map(({ key, bar }) => (
          <span key={key} className={cn("h-full", bar)} style={{ width: `${(environments[key] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Credentials by environment">
        {segments.map(({ key }) => (
          <li key={key}>
            <Badge tone={key === "unassigned" ? "neutral" : envTone(key)} size="sm">
              {key === "unassigned" ? "no environment" : key}
              <span className="font-medium opacity-80">{environments[key].toLocaleString()}</span>
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectCard({ project, now, currentUserId }: ProjectCardProps) {
  const personal = project.organizationId === null;
  const privateInOrg = !personal && project.visibility === "private";
  const members =
    personal && project.memberCount === 0 && project.ownerId === currentUserId
      ? "Only you"
      : pluralize(project.memberCount, "member");
  const updated = formatUpdated(project.updatedAt, now);

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      data-testid="project-card"
      data-project-id={project.id}
      className={cn(cardClass, "group flex flex-col gap-4 hover:border-line-strong")}
    >
      <div className="flex items-start gap-3">
        <Avatar name={project.name} shape="square" size="xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 break-words text-base font-bold leading-snug text-ink group-hover:text-accent-ink">
              {project.name}
            </h2>
            <Badge tone={ROLE_TONE[project.currentUserRole]} size="sm" className="mt-0.5 flex-none">
              <span className="sr-only">Your role: </span>
              {ROLE_LABEL[project.currentUserRole]}
            </Badge>
          </div>
          <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-muted">
            {personal ? (
              <User className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            ) : (
              <Building2 className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            )}
            <span className="truncate">{personal ? "Personal" : (project.organizationName ?? "Organisation")}</span>
            {privateInOrg && (
              <>
                <span aria-hidden="true">·</span>
                <Lock className="h-3 w-3 flex-none" aria-hidden="true" />
                <span>Private</span>
              </>
            )}
          </p>
          {project.description && (
            <p className="line-clamp-2 text-[13.5px] leading-[1.45] text-muted">{project.description}</p>
          )}
        </div>
      </div>

      <EnvironmentBreakdown environments={project.environments} total={project.credentialCount} />

      <div className="mt-auto flex items-center gap-3 border-t border-line-soft pt-3.5 text-[13.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <KeyRound className="h-[15px] w-[15px]" aria-hidden="true" />
          {pluralize(project.credentialCount, "credential")}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-[15px] w-[15px]" aria-hidden="true" />
          {members}
        </span>
        {updated && (
          <time dateTime={project.updatedAt} className="ml-auto whitespace-nowrap" title={`Updated ${updated}`}>
            {updated}
          </time>
        )}
      </div>
    </Link>
  );
}

/** Dashed tile at the end of the grid that starts a new project. */
export function NewProjectTile() {
  return (
    <Link
      href="/dashboard/projects/new"
      data-testid="new-project-tile"
      className={cn(
        cardClass,
        "flex min-h-[190px] flex-col items-center justify-center gap-2.5 border-2 border-dashed border-line-strong bg-transparent text-center shadow-none hover:border-accent/60 hover:bg-surface"
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <Plus className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-[15px] font-semibold text-ink-2">Create a project</span>
      <span className="text-[13.5px] text-muted">Or import from JSON in Settings</span>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 flex-none rounded-[10px]" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line-soft pt-3.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
    </div>
  );
}
