"use client";

import { useState, type FormEvent } from "react";
import { notify } from "@/components/Toast";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api, errorMessage } from "@/lib/api-client";
import { canManageProject, type ProjectDetail, type ProjectSummary } from "./model";

const NAME_MIN = 2;
const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const FORM_ID = "edit-project-form";

interface EditProjectModalProps {
  open: boolean;
  project: ProjectDetail;
  onClose: () => void;
  onSaved: (summary: ProjectSummary) => void;
}

/** Mount with a `key` that changes per opening so the form starts from the current project. */
export function EditProjectModal({ open, project, onClose, onSaved }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [visibility, setVisibility] = useState(project.visibility);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canChangeVisibility = canManageProject(project.currentUserRole) && project.organizationId !== null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) {
      setNameError(`Use ${NAME_MIN}–${NAME_MAX} characters.`);
      return;
    }
    setNameError(null);

    const changes: Record<string, string> = {};
    if (trimmedName !== project.name) changes.name = trimmedName;
    if (description.trim() !== project.description) changes.description = description.trim();
    if (canChangeVisibility && visibility !== project.visibility) changes.visibility = visibility;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const summary = await api.patch<ProjectSummary>(`/api/projects/${encodeURIComponent(project.id)}`, changes);
      onSaved(summary);
      notify.success("Project updated");
      onClose();
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't update the project"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit project"
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Name" required error={nameError}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX}
            autoComplete="off"
          />
        </Field>
        <Field label="Description" optional hint={`${description.length}/${DESCRIPTION_MAX}`}>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={3}
          />
        </Field>
        {canChangeVisibility && (
          <Field
            label="Visibility"
            hint={
              visibility === "private"
                ? "Only organization owners and admins, the project owner and members you add can open it."
                : "Organization members can edit it; organization viewers can read it."
            }
          >
            <Select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value="organization">Organization</option>
              <option value="private">Private</option>
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  );
}
