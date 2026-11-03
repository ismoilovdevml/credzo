"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, KeyRound, Pencil, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ServiceIcon } from "@/components/ServiceIcon";
import { notify } from "@/components/Toast";
import { useSession } from "@/components/shell/SessionProvider";
import { Button, EmptyState, EnvBadge, PageHeader, Skeleton } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { getServiceMetadata } from "@/lib/services";
import type { ServiceType } from "@/lib/types";
import type { CredentialView } from "@/lib/utils/credentials";
import { ActivityCard } from "./ActivityCard";
import { ConnectionString } from "./ConnectionString";
import { DetailsCard } from "./DetailsCard";
import { FieldList, buildFieldEntries } from "./FieldList";
import { RotationCard } from "./RotationCard";
import { useCredentialSecrets } from "./useCredentialSecrets";

type ProjectRole = "owner" | "editor" | "viewer";

type CredentialDetailData = CredentialView & { projectName: string; currentUserRole: ProjectRole };

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; credential: CredentialDetailData };

interface OrganizationMemberWithUser {
  userId: string;
  user: { id: string; username: string; firstName: string; lastName: string } | null;
}

const MINUTE = 60_000;

/** Current time, refreshed every minute for relative labels. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** user id → display name, from the active organisation's member list (empty when not in an org). */
function useMemberNames(organizationId: string | undefined): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    api.get<OrganizationMemberWithUser[]>(`/api/organizations/${organizationId}/members`)
      .then((members) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const { userId, user } of members) {
          if (!user) continue;
          map.set(userId, `${user.firstName} ${user.lastName}`.trim() || user.username);
        }
        setNames(map);
      })
      .catch(() => {
        // Names are a nicety: stamps and activity fall back to showing no name.
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return names;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading credential">
      <Skeleton className="h-4 w-56" />
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-60" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-64 rounded-2xl" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[13.5px] text-muted">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 flex-none" aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="truncate rounded-sm font-medium hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-ink-2">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Credential detail screen: fields with audited reveal, connection string, rotation, metadata and activity. */
export function CredentialDetail() {
  const params = useParams<{ id: string; credentialId: string }>();
  const credentialId = params.credentialId;
  const router = useRouter();
  const session = useSession();
  const now = useNow();
  const memberNames = useMemberNames(session.organization?.id);
  const secrets = useCredentialSecrets(credentialId);

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<CredentialDetailData>(`/api/credentials/${credentialId}`)
      .then((credential) => {
        if (!cancelled) setState({ status: "ready", credential });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) setState({ status: "not-found" });
        else setState({ status: "error", message: errorMessage(error, "Couldn't load this credential") });
      });
    return () => {
      cancelled = true;
    };
  }, [credentialId, reloadKey]);

  const credential = state.status === "ready" ? state.credential : null;

  useEffect(() => {
    if (credential) document.title = `${credential.name} · Credzo`;
    else if (state.status === "not-found") document.title = "Credential not found · Credzo";
  }, [credential, state.status]);

  const userId = session.user?.id;
  const resolveName = useCallback(
    (id: string | null): string | null => {
      if (!id) return null;
      if (id === userId) return "You";
      return memberNames.get(id) ?? null;
    },
    [memberNames, userId]
  );

  const entries = useMemo(
    () => (credential ? buildFieldEntries(credential.type, credential.fields, credential.secretFields) : []),
    [credential]
  );

  if (state.status === "loading") return <DetailSkeleton />;

  if (state.status === "not-found") {
    return (
      <EmptyState
        icon={<KeyRound />}
        title="Credential not found"
        description="It may have been deleted, or you don't have access to its project."
        action={
          <Button asChild variant="secondary">
            <Link href={`/dashboard/projects/${params.id}`}>Back to project</Link>
          </Button>
        }
      />
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="Couldn't load this credential"
        description={state.message}
        action={
          <Button
            variant="secondary"
            leftIcon={<RotateCcw />}
            onClick={() => {
              setState({ status: "loading" });
              setReloadKey((key) => key + 1);
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  const cred = state.credential;
  const service = getServiceMetadata(cred.type as ServiceType);
  const serviceLabel = service?.label ?? cred.type;
  const canEdit = cred.currentUserRole === "owner" || cred.currentUserRole === "editor";
  const projectHref = `/dashboard/projects/${cred.projectId}`;
  const editHref = `${projectHref}/credentials/${cred.id}/edit`;
  const hasPassword = cred.secretFields.includes("password");
  const revealedPassword = secrets.revealed.has("password") ? (secrets.values?.password ?? null) : null;
  // The audit log is per organization: only show activity when this credential lives in the active one.
  const auditOrganizationId =
    session.isAdmin && cred.organizationId !== null && cred.organizationId === session.organization?.id
      ? cred.organizationId
      : undefined;

  const markRotated = async () => {
    try {
      const updated = await api.post<CredentialView>(`/api/credentials/${encodeURIComponent(cred.id)}/rotated`);
      setState((current) =>
        current.status === "ready" ? { status: "ready", credential: { ...current.credential, ...updated } } : current
      );
      notify.success("Marked as rotated");
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't mark the credential as rotated"));
    }
  };

  const handleDelete = async () => {
    try {
      await api.del<{ id: string }>(`/api/credentials/${cred.id}`);
      notify.success(`Deleted "${cred.name}"`);
      router.push(projectHref);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't delete the credential"));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Projects", href: "/dashboard/projects" },
          { label: cred.projectName, href: projectHref },
          { label: cred.name },
        ]}
      />

      <PageHeader
        leading={
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-info-soft text-info">
            <ServiceIcon type={cred.type} className="h-6 w-6" />
          </span>
        }
        title={<span data-testid="credential-name">{cred.name}</span>}
        meta={
          <>
            <span>{serviceLabel}</span>
            {cred.environment && (
              <>
                <span aria-hidden="true">·</span>
                <EnvBadge env={cred.environment} />
              </>
            )}
          </>
        }
        actions={
          canEdit && (
            <>
              <Button asChild variant="secondary" size="sm" leftIcon={<Pencil />}>
                <Link href={editHref} data-testid="edit-credential">
                  Edit
                </Link>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Trash2 />}
                onClick={() => setConfirmDelete(true)}
                data-testid="delete-credential"
                className="border-danger/30 text-danger hover:border-danger/50 hover:bg-danger-soft"
              >
                Delete
              </Button>
            </>
          )
        }
      />

      {cred.environment === "production" && cred.secretFields.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3.5">
          <ShieldAlert className="mt-0.5 h-[18px] w-[18px] flex-none text-warn" aria-hidden="true" />
          <p className="text-[14px] leading-relaxed text-ink-2">
            Production secret. Revealing or copying it is recorded in the audit log and visible to admins.
          </p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="fields-heading" className="flex flex-col gap-2">
            <h2 id="fields-heading" className="text-[13.5px] font-semibold text-ink-2">
              Fields
            </h2>
            {entries.length > 0 ? (
              <FieldList entries={entries} secrets={secrets} />
            ) : (
              <EmptyState
                icon={<KeyRound />}
                title="No fields stored"
                description={canEdit ? "Edit this credential to add connection details." : undefined}
                className="py-8"
              />
            )}
          </section>

          <ConnectionString
            type={cred.type}
            fields={cred.fields}
            hasPassword={hasPassword}
            revealedPassword={revealedPassword}
            getPassword={() => secrets.getSecret("password")}
          />

          {cred.description && (
            <section aria-labelledby="description-heading" className="flex flex-col gap-2">
              <h2 id="description-heading" className="text-[13.5px] font-semibold text-ink-2">
                Description
              </h2>
              <p
                data-testid="credential-description"
                className="whitespace-pre-wrap break-words rounded-xl bg-surface-2 px-3.5 py-3 text-[14.5px] leading-relaxed text-ink-2"
              >
                {cred.description}
              </p>
            </section>
          )}

          {auditOrganizationId && (
            <ActivityCard
              credentialId={cred.id}
              organizationId={auditOrganizationId}
              now={now}
              resolveName={resolveName}
            />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-6" aria-label="Credential details">
          <RotationCard
            rotationDays={cred.rotationDays}
            lastRotatedAt={cred.lastRotatedAt}
            createdAt={cred.createdAt}
            now={now}
            editHref={canEdit ? editHref : undefined}
            onMarkRotated={canEdit ? markRotated : undefined}
          />
          <DetailsCard
            serviceLabel={serviceLabel}
            category={service?.category}
            environment={cred.environment}
            projectName={cred.projectName}
            projectHref={projectHref}
            createdAt={cred.createdAt}
            createdBy={resolveName(cred.createdBy)}
            updatedAt={cred.updatedAt}
            updatedBy={resolveName(cred.updatedBy)}
          />
        </aside>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete credential?"
        message={`"${cred.name}" and its stored secrets will be permanently removed from ${cred.projectName}. This can't be undone.`}
        confirmText="Delete credential"
        variant="danger"
      />
    </div>
  );
}
