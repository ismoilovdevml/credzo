"use client";

import Link from "next/link";
import { Building2, Lock, Pencil, Plus, Trash2, User, UserPlus } from "lucide-react";
import { Avatar, Badge, Button, IconButton, PageHeader } from "@/components/ui";
import {
  canEditProject,
  canManageProject,
  roleLabel,
  roleTone,
  userName,
  type ProjectDetail,
} from "./model";

interface ProjectHeaderProps {
  project: ProjectDetail;
  /** Name of the project's organisation when known (the active organisation). */
  organizationName: string | null;
  onAddMember: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProjectHeader({ project, organizationName, onAddMember, onEdit, onDelete }: ProjectHeaderProps) {
  const role = project.currentUserRole;
  const isOrgProject = project.organizationId !== null;
  const ownerName = project.owner ? userName(project.owner) : null;
  const description = [project.description, ownerName && `Owner: ${ownerName}`].filter(Boolean).join(" · ");

  return (
    <PageHeader
      back={{ href: "/dashboard/projects", label: "Projects" }}
      leading={<Avatar name={project.name} size="xl" shape="square" tone="accent" />}
      title={project.name}
      description={description || undefined}
      meta={
        <>
          {isOrgProject ? (
            <Badge tone="neutral">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {organizationName ?? "Organization"}
            </Badge>
          ) : (
            <Badge tone="neutral">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              Personal
            </Badge>
          )}
          {isOrgProject && project.visibility === "private" && (
            <Badge tone="warn">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Private
            </Badge>
          )}
          <Badge tone={roleTone(role)}>
            <span className="sr-only">Your role: </span>
            {roleLabel(role)}
          </Badge>
        </>
      }
      actions={
        <>
          {canManageProject(role) && isOrgProject && (
            <Button variant="secondary" leftIcon={<UserPlus />} onClick={onAddMember}>
              Add member
            </Button>
          )}
          {canEditProject(role) && (
            <Button variant="secondary" leftIcon={<Pencil />} onClick={onEdit} data-testid="edit-project">
              Edit
            </Button>
          )}
          {canManageProject(role) && (
            <IconButton
              label="Delete project"
              variant="secondary"
              size="lg"
              className="text-danger hover:bg-danger-soft hover:text-danger"
              onClick={onDelete}
              data-testid="delete-project"
            >
              <Trash2 />
            </IconButton>
          )}
          {canEditProject(role) && (
            <Button asChild leftIcon={<Plus />}>
              <Link
                href={`/dashboard/projects/${encodeURIComponent(project.id)}/credentials/new`}
                data-testid="add-credential-button"
              >
                Add credential
              </Link>
            </Button>
          )}
        </>
      }
    />
  );
}
