"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { ServiceIcon } from "@/components/ServiceIcon";
import { notify } from "@/components/Toast";
import { getServiceMetadata } from "@/lib/services";
import { apiRequest, errorMessage } from "./api";
import { CredentialDetailsForm } from "./CredentialDetailsForm";
import { FormHeader, FormSkeleton, LoadError, StepCard, ViewerNotice, useLeaveGuard } from "./FormChrome";
import {
  type CredentialDetail,
  type CredentialFormValues,
  type FormErrors,
  buildPatch,
  firstInvalidInputId,
  formValuesFromCredential,
  hasChanges,
  validateCredentialForm,
} from "./form-model";
import { categoryTone } from "./ServicePicker";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "viewer"; credential: CredentialDetail }
  | { status: "ready"; credential: CredentialDetail; initial: CredentialFormValues };

export function EditCredentialScreen({ projectId, credentialId }: { projectId: string; credentialId: string }) {
  const router = useRouter();
  const projectHref = `/dashboard/projects/${encodeURIComponent(projectId)}`;
  const detailHref = `${projectHref}/credentials/${encodeURIComponent(credentialId)}`;

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState<CredentialFormValues | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const base = `/api/credentials/${encodeURIComponent(credentialId)}`;

    (async () => {
      const credential = await apiRequest<CredentialDetail>(base);
      if (credential.projectId !== projectId) throw new Error("This credential doesn't belong to this project.");
      if (credential.currentUserRole === "viewer") return { status: "viewer", credential } as const;
      // Secrets are needed to prefill the form; reveal is audit-logged as an access.
      const revealed = await apiRequest<{ fields: Record<string, string> }>(`${base}/reveal`, { method: "POST" });
      return { status: "ready", credential, initial: formValuesFromCredential(credential, revealed.fields) } as const;
    })()
      .then((next) => {
        if (cancelled) return;
        setLoad(next);
        if (next.status === "ready") setValues(next.initial);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: "error", message: errorMessage(error, "The credential couldn't be loaded.") });
      });

    return () => {
      cancelled = true;
    };
  }, [credentialId, projectId, attempt]);

  const ready = load.status === "ready" ? load : null;
  const dirty = ready !== null && values !== null && hasChanges(ready.credential.type, ready.initial, values);
  const { requestLeave, dialog } = useLeaveGuard(dirty, detailHref);

  const storedFields = useMemo(
    () => new Set(ready ? Object.keys(ready.initial.fields).filter((name) => ready.initial.fields[name]) : []),
    [ready]
  );

  const changeValues = (next: CredentialFormValues) => {
    setValues(next);
    if (submitted && ready) setErrors(validateCredentialForm(ready.credential.type, next));
  };

  const submit = async () => {
    if (!ready || !values || saving) return;
    const { type } = ready.credential;
    const nextErrors = validateCredentialForm(type, values);
    setSubmitted(true);
    setErrors(nextErrors);
    const invalidId = firstInvalidInputId(type, nextErrors);
    if (invalidId) {
      document.getElementById(invalidId)?.focus();
      return;
    }

    const patch = buildPatch(type, ready.initial, values);
    if (Object.keys(patch).length === 0) {
      notify.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      await apiRequest(`/api/credentials/${encodeURIComponent(credentialId)}`, { method: "PATCH", body: patch });
      notify.success("Changes saved");
      router.push(detailHref);
    } catch (error) {
      notify.error(errorMessage(error, "The changes couldn't be saved."));
      setSaving(false);
    }
  };

  const credential = load.status === "ready" || load.status === "viewer" ? load.credential : null;
  const service = credential ? getServiceMetadata(credential.type) : undefined;

  let body;
  if (load.status === "loading") {
    body = <FormSkeleton />;
  } else if (load.status === "error") {
    body = (
      <LoadError
        message={load.message}
        backHref={projectHref}
        onRetry={() => {
          setLoad({ status: "loading" });
          setAttempt((value) => value + 1);
        }}
      />
    );
  } else if (load.status === "viewer") {
    body = (
      <ViewerNotice backHref={detailHref}>
        Viewers can open and reveal this credential but can&apos;t change it. Ask a project owner for editor access.
      </ViewerNotice>
    );
  } else if (values) {
    const { type } = load.credential;
    body = (
      <StepCard
        id="credential-details"
        className="max-w-3xl"
        title={
          <>
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${categoryTone(service?.category ?? "")}`}
              aria-hidden="true"
            >
              <ServiceIcon type={type} className="h-4 w-4" />
            </span>
            <span className="truncate">{service?.label ?? type} details</span>
          </>
        }
      >
        <p className="-mt-1 flex items-center gap-1.5 text-[13px] text-muted">
          <Lock className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          The service type can&apos;t be changed. Create a new credential to use a different service.
        </p>
        <CredentialDetailsForm
          type={type}
          values={values}
          onChange={changeValues}
          errors={errors}
          onSubmit={submit}
          storedFields={storedFields}
        />
      </StepCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FormHeader
        title={credential ? `Edit ${credential.name}` : "Edit credential"}
        projectName={credential?.projectName}
        onCancel={requestLeave}
        showSave={load.status === "ready"}
        saving={saving}
        saveDisabled={!dirty}
        saveLabel="Save changes"
      />
      {body}
      {dialog}
    </div>
  );
}
