import type { Metadata } from "next";
import { ProjectDetail } from "@/components/project-detail/ProjectDetail";

// The client view replaces this with the project name once it loads.
export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail key={id} projectId={id} />;
}
