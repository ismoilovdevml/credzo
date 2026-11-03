import type { Metadata } from "next";
import { NewProjectForm } from "@/components/new-project/NewProjectForm";

export const metadata: Metadata = {
  title: "New project",
};

export default function NewProjectPage() {
  return <NewProjectForm />;
}
