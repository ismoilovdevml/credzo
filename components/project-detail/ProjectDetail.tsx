"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderX } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSession } from "@/components/shell/SessionProvider";
import { notify } from "@/components/Toast";
import { Button, EmptyState, Skeleton, Tab, TabList, TabPanel, Tabs } from "@/components/ui";
import type { Service } from "@/lib/types";
import { AddMemberModal } from "./AddMemberModal";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { CredentialsPanel } from "./CredentialsPanel";
import { EditProjectModal } from "./EditProjectModal";
import { MembersPanel } from "./MembersPanel";
import { canEditProject, type ProjectDetail as ProjectData, type ProjectMemberView, type ProjectSummary } from "./model";
import { ProjectHeader } from "./ProjectHeader";
import { ServicesPanel, type ServicesState } from "./ServicesPanel";
import { HealthCard, TeamCard } from "./SideCards";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  /** `loadedAt` is the reference time for relative dates and rotation status. */
  | { status: "ready"; project: ProjectData; loadedAt: number };

type Section = "credentials" | "services" | "members";
type Dialog = "edit" | "delete" | "add-member" | null;

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { refreshProjectCount } = useSession();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [services, setServices] = useState<ServicesState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [servicesKey, setServicesKey] = useState(0);
  const [section, setSection] = useState<Section>("credentials");
  const [dialog, setDialog] = useState<Dialog>(null);
  // Remounts the form modals on each opening so they start from the current project.
  const [dialogKey, setDialogKey] = useState(0);

  const projectPath = `/api/projects/${encodeURIComponent(projectId)}`;

  useEffect(() => {
    let cancelled = false;
    api.get<ProjectData>(projectPath)
      .then((project) => {
        if (!cancelled) setState({ status: "ready", project, loadedAt: Date.now() });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
          setState({ status: "not-found" });
        } else {
          setState({ status: "error", message: errorMessage(error, "Couldn't load this project") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    api.get<Service[]>(`${projectPath}/services`)
      .then((list) => {
        if (!cancelled) setServices({ status: "ready", services: list });
      })
      .catch((error: unknown) => {
        if (!cancelled) setServices({ status: "error", message: errorMessage(error, "Couldn't load services") });
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath, servicesKey]);

  const projectName = state.status === "ready" ? state.project.name : null;
  useEffect(() => {
    if (projectName) document.title = `${projectName} · Credzo`;
  }, [projectName]);

  const updateProject = useCallback((update: (project: ProjectData) => ProjectData) => {
    setState((current) => (current.status === "ready" ? { ...current, project: update(current.project) } : current));
  }, []);

  const openDialog = (next: Exclude<Dialog, null>) => {
    setDialogKey((key) => key + 1);
    setDialog(next);
  };

  if (state.status === "loading") return <ProjectDetailSkeleton />;

  if (state.status === "not-found") {
    return (
      <EmptyState
        icon={<FolderX />}
        title="Project not found"
        description="This project doesn't exist, was deleted, or you don't have access to it."
        action={
          <Button asChild>
            <Link href="/dashboard/projects">Back to projects</Link>
          </Button>
        }
        className="mt-6"
      />
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        title="Couldn't load this project"
        description={state.message}
        action={
          <>
            <Button
              onClick={() => {
                setState({ status: "loading" });
                setReloadKey((key) => key + 1);
              }}
            >
              Try again
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/projects">Back to projects</Link>
            </Button>
          </>
        }
        className="mt-6"
      />
    );
  }

  const { project, loadedAt } = state;
  const canEdit = canEditProject(project.currentUserRole);

  const handleSaved = (summary: ProjectSummary) =>
    updateProject((current) => ({
      ...current,
      name: summary.name,
      description: summary.description,
      visibility: summary.visibility,
      updatedAt: summary.updatedAt,
    }));

  const handleDeleteProject = async () => {
    try {
      await api.del(projectPath);
      notify.success(`Deleted "${project.name}"`);
      await refreshProjectCount();
      router.push("/dashboard/projects");
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't delete the project"));
    }
  };

  const handleMemberChanged = (member: ProjectMemberView) =>
    updateProject((current) => ({
      ...current,
      members: current.members.some((existing) => existing.id === member.id)
        ? current.members.map((existing) => (existing.id === member.id ? member : existing))
        : [member, ...current.members],
    }));

  const handleMemberRemoved = (memberId: string) =>
    updateProject((current) => ({
      ...current,
      members: current.members.filter((member) => member.id !== memberId),
    }));

  const handleCredentialDeleted = (credentialId: string) =>
    updateProject((current) => ({
      ...current,
      credentials: current.credentials.filter((credential) => credential.id !== credentialId),
    }));

  const credentialCount = project.credentials.length;

  return (
    <div className="flex flex-col gap-6">
      <ProjectHeader
        project={project}
        onAddMember={() => {
          setSection("members");
          openDialog("add-member");
        }}
        onEdit={() => openDialog("edit")}
        onDelete={() => setDialog("delete")}
      />

      <Tabs value={section} onValueChange={(value) => setSection(value as Section)}>
        <TabList aria-label="Project sections">
          <Tab value="credentials" count={credentialCount}>
            Credentials
          </Tab>
          <Tab value="services" count={services.status === "ready" ? services.services.length : undefined}>
            Services
          </Tab>
          <Tab value="members" count={project.members.length + (project.owner ? 1 : 0)}>
            Members
          </Tab>
        </TabList>

        <TabPanel value="credentials" className="pt-6 focus-visible:outline-none">
          <div className="flex flex-wrap items-start gap-5">
            <div className="min-w-0 flex-[999_1_560px]">
              <CredentialsPanel
                projectId={project.id}
                credentials={project.credentials}
                canEdit={canEdit}
                now={loadedAt}
                onDeleted={handleCredentialDeleted}
              />
            </div>
            <aside aria-label="Project overview" className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
              <TeamCard project={project} onManage={() => setSection("members")} />
              <HealthCard credentials={project.credentials} now={loadedAt} />
            </aside>
          </div>
        </TabPanel>

        <TabPanel value="services" className="pt-6 focus-visible:outline-none">
          <ServicesPanel
            projectId={project.id}
            state={services}
            canEdit={canEdit}
            onRetry={() => {
              setServices({ status: "loading" });
              setServicesKey((key) => key + 1);
            }}
            onChange={(list) => setServices({ status: "ready", services: list })}
          />
        </TabPanel>

        <TabPanel value="members" className="pt-6 focus-visible:outline-none">
          <MembersPanel
            project={project}
            onAddMember={() => openDialog("add-member")}
            onMemberChanged={handleMemberChanged}
            onMemberRemoved={handleMemberRemoved}
          />
        </TabPanel>
      </Tabs>

      <EditProjectModal
        key={`edit-${dialogKey}`}
        open={dialog === "edit"}
        project={project}
        onClose={() => setDialog(null)}
        onSaved={handleSaved}
      />
      {project.organizationId && (
        <AddMemberModal
          key={`member-${dialogKey}`}
          open={dialog === "add-member"}
          project={project}
          onClose={() => setDialog(null)}
          onAdded={handleMemberChanged}
        />
      )}
      <ConfirmDialog
        isOpen={dialog === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={handleDeleteProject}
        title="Delete project?"
        message={`"${project.name}" will be permanently deleted. This can't be undone.`}
        details={[
          `${credentialCount} ${credentialCount === 1 ? "credential" : "credentials"} and their secrets`,
          "All services and member grants",
        ]}
        confirmText="Delete project"
        variant="danger"
      />
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading project">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-11 w-full max-w-md" />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-[320px] w-full rounded-2xl" />
        </div>
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <Skeleton className="h-[220px] w-full rounded-2xl" />
          <Skeleton className="h-[160px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
