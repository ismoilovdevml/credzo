import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Avatar, Card, CardHeader, EnvBadge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { formatUpdated, pluralize, type ProjectSummary } from "./insights";
import { RowsSkeleton, SectionLink, SectionMessage, rowLinkClass } from "./section";

const MAX_PROJECTS = 4;
const ENVIRONMENTS = ["production", "staging", "development"] as const;

/** The most recently updated projects ("Your projects" in the mockup). */
export function RecentProjects({ projects, now }: { projects: ProjectSummary[] | null; now: number }) {
  const recent = projects
    ? [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, MAX_PROJECTS)
    : null;

  return (
    <Card className="overflow-hidden" data-testid="recent-projects">
      <CardHeader title="Your projects" actions={<SectionLink href="/dashboard/projects">View all</SectionLink>} />
      {recent === null ? (
        <RowsSkeleton rows={MAX_PROJECTS} />
      ) : recent.length === 0 ? (
        <SectionMessage icon={<FolderOpen />} title="No projects yet" />
      ) : (
        <ul className="flex flex-col">
          {recent.map((project) => {
            const envs = ENVIRONMENTS.filter((env) => project.environments[env] > 0);
            return (
              <li key={project.id} className="border-b border-line-soft last:border-b-0">
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  data-testid="recent-project-item"
                  data-project-id={project.id}
                  className={cn("flex items-center gap-3.5 px-5 py-4", rowLinkClass)}
                >
                  <Avatar name={project.name} shape="square" size="lg" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold text-ink">{project.name}</span>
                    <span className="truncate text-[13px] text-muted">
                      {pluralize(project.credentialCount, "credential")} · {formatUpdated(project.updatedAt, now)}
                    </span>
                  </span>
                  {envs.length > 0 && (
                    <span className="hidden flex-none gap-1.5 sm:flex">
                      {envs.map((env) => (
                        <EnvBadge key={env} env={env} short size="sm" />
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
