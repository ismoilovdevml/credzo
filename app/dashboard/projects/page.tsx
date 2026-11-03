import { Suspense } from "react";
import type { Metadata } from "next";
import { ProjectsPageFallback, ProjectsView } from "@/components/projects/ProjectsView";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectsPageFallback />}>
      <ProjectsView />
    </Suspense>
  );
}
