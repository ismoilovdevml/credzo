"use client";

import { useState } from "react";
import { ExternalLink, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { notify } from "@/components/Toast";
import { Badge, Button, Card, EmptyState, IconButton, Skeleton } from "@/components/ui";
import type { Service } from "@/lib/types";
import { api, errorMessage } from "@/lib/api-client";
import { ServiceModal } from "./ServiceModal";

export type ServicesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; services: Service[] };

interface ServicesPanelProps {
  projectId: string;
  state: ServicesState;
  canEdit: boolean;
  onRetry: () => void;
  onChange: (services: Service[]) => void;
}

type Editor = { open: boolean; service: Service | null; key: number };

export function ServicesPanel({ projectId, state, canEdit, onRetry, onChange }: ServicesPanelProps) {
  const [editor, setEditor] = useState<Editor>({ open: false, service: null, key: 0 });
  const [pendingDelete, setPendingDelete] = useState<Service | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const services = state.status === "ready" ? state.services : [];

  const openEditor = (service: Service | null) =>
    setEditor((current) => ({ open: true, service, key: current.key + 1 }));

  const handleSaved = (saved: Service) => {
    const exists = services.some((service) => service.id === saved.id);
    onChange(exists ? services.map((service) => (service.id === saved.id ? saved : service)) : [...services, saved]);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.del(
        `/api/projects/${encodeURIComponent(projectId)}/services/${encodeURIComponent(pendingDelete.id)}`
      );
      onChange(services.filter((service) => service.id !== pendingDelete.id));
      notify.success(`Deleted "${pendingDelete.name}"`);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't delete the service"));
    }
  };

  let content;
  if (state.status === "loading") {
    content = (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading services">
        <Skeleton className="h-[84px] w-full rounded-2xl" />
        <Skeleton className="h-[84px] w-full rounded-2xl" />
      </div>
    );
  } else if (state.status === "error") {
    content = (
      <EmptyState
        title="Couldn't load services"
        description={state.message}
        action={
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  } else if (services.length === 0) {
    content = (
      <EmptyState
        icon={<Layers />}
        title="No services yet"
        description="List the dashboards, consoles and endpoints this project depends on, with links and tags."
        action={
          canEdit && (
            <Button leftIcon={<Plus />} onClick={() => openEditor(null)}>
              Add service
            </Button>
          )
        }
      />
    );
  } else {
    content = (
      <Card>
        <ul className="divide-y divide-line-soft">
          {services.map((service) => (
            <li
              key={service.id}
              data-testid="service-row"
              data-service-id={service.id}
              className="flex flex-wrap items-start gap-3 px-5 py-4"
            >
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                <span className="break-words text-[15px] font-semibold text-ink">{service.name}</span>
                {service.url && (
                  <a
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit max-w-full items-center gap-1.5 rounded font-mono text-[12.5px] text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <span className="truncate">{service.url}</span>
                    <ExternalLink className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
                {service.description && <p className="text-[14px] leading-relaxed text-ink-2">{service.description}</p>}
                {service.tags && service.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {service.tags.map((tag) => (
                      <Badge key={tag} size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <IconButton label={`Edit ${service.name}`} onClick={() => openEditor(service)}>
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label={`Delete ${service.name}`}
                    variant="danger"
                    onClick={() => {
                      setPendingDelete(service);
                      setConfirmOpen(true);
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <section aria-label="Services" className="flex flex-col gap-4">
      {canEdit && state.status === "ready" && services.length > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" leftIcon={<Plus />} onClick={() => openEditor(null)}>
            Add service
          </Button>
        </div>
      )}
      {content}

      <ServiceModal
        key={editor.key}
        open={editor.open}
        projectId={projectId}
        service={editor.service}
        onClose={() => setEditor((current) => ({ ...current, open: false }))}
        onSaved={handleSaved}
      />
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete service?"
        message={`"${pendingDelete?.name ?? ""}" will be removed from this project. Credentials are not affected.`}
        confirmText="Delete service"
        variant="danger"
      />
    </section>
  );
}
