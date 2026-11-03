"use client";

import { useState, type FormEvent } from "react";
import { notify } from "@/components/Toast";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import type { Service } from "@/lib/types";
import { apiRequest, errorMessage } from "./api";

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const MAX_TAGS = 20;
const TAG_MAX = 40;
const FORM_ID = "project-service-form";

interface ServiceModalProps {
  open: boolean;
  projectId: string;
  /** Service to edit; omit to create one. */
  service?: Service | null;
  onClose: () => void;
  onSaved: (service: Service) => void;
}

interface FormErrors {
  name?: string;
  url?: string;
  tags?: string;
}

function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

function validate(name: string, url: string, tags: string[]): FormErrors {
  const errors: FormErrors = {};
  if (!name.trim()) errors.name = "Enter a service name.";
  if (url.trim()) {
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") errors.url = "Use an http:// or https:// URL.";
    } catch {
      errors.url = "Enter a valid URL, e.g. https://grafana.example.com.";
    }
  }
  if (tags.length > MAX_TAGS) errors.tags = `Use at most ${MAX_TAGS} tags.`;
  else if (tags.some((tag) => tag.length > TAG_MAX)) errors.tags = `Each tag can be at most ${TAG_MAX} characters.`;
  return errors;
}

/** Create or edit a project service. Mount with a fresh `key` per opening. */
export function ServiceModal({ open, projectId, service, onClose, onSaved }: ServiceModalProps) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [url, setUrl] = useState(service?.url ?? "");
  const [tags, setTags] = useState((service?.tags ?? []).join(", "));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tagList = parseTags(tags);
    const nextErrors = validate(name, url, tagList);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const base = `/api/projects/${encodeURIComponent(projectId)}/services`;
    setSaving(true);
    try {
      const saved = await apiRequest<Service>(service ? `${base}/${encodeURIComponent(service.id)}` : base, {
        method: service ? "PATCH" : "POST",
        body: { name: name.trim(), description: description.trim(), url: url.trim(), tags: tagList },
      });
      onSaved(saved);
      notify.success(service ? "Service updated" : "Service added");
      onClose();
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't save the service"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? "Edit service" : "Add service"}
      description="Keep track of the dashboards, consoles and endpoints this project runs on."
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving}>
            {service ? "Save changes" : "Add service"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Name" required error={errors.name}>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={NAME_MAX} autoComplete="off" />
        </Field>
        <Field label="URL" optional error={errors.url}>
          <Input
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://grafana.example.com"
            autoComplete="off"
            mono
          />
        </Field>
        <Field label="Description" optional>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={3}
          />
        </Field>
        <Field label="Tags" optional hint="Separate tags with commas." error={errors.tags}>
          <Input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="monitoring, internal"
            autoComplete="off"
          />
        </Field>
      </form>
    </Modal>
  );
}
