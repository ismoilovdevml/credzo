"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MousePointerClick } from "lucide-react";
import { ServiceIcon } from "@/components/ServiceIcon";
import { notify } from "@/components/Toast";
import { getServiceMetadata } from "@/lib/services";
import type { ServiceType } from "@/lib/types";
import { apiRequest, errorMessage } from "./api";
import { CredentialDetailsForm } from "./CredentialDetailsForm";
import { FormHeader, FormSkeleton, LoadError, StepCard, ViewerNotice, useLeaveGuard } from "./FormChrome";
import {
  type CredentialFormValues,
  type FormErrors,
  buildCreatePayload,
  emptyFormValues,
  firstInvalidInputId,
  hasChanges,
  serviceFields,
  validateCredentialForm,
} from "./form-model";
import { takeGeneratorPrefill, withoutPrefillParam } from "./generate-secret";
import { ServicePicker, categoryTone } from "./ServicePicker";

interface ProjectInfo {
  name: string;
  currentUserRole: string;
}

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; project: ProjectInfo };

const INITIAL_VALUES = emptyFormValues();

function parseServiceType(value: string | null): ServiceType | null {
  return value && getServiceMetadata(value as ServiceType) ? (value as ServiceType) : null;
}

/** Puts the hand-off secret into the first empty password field of the service. */
function applyPrefill(type: ServiceType, values: CredentialFormValues, secret: string | null): CredentialFormValues {
  if (!secret) return values;
  const target = serviceFields(type).find((field) => field.type === "password");
  if (!target || values.fields[target.name]) return values;
  return { ...values, fields: { ...values.fields, [target.name]: secret } };
}

export function NewCredentialScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectHref = `/dashboard/projects/${encodeURIComponent(projectId)}`;

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [type, setType] = useState<ServiceType | null>(() => parseServiceType(searchParams.get("type")));
  const [values, setValues] = useState<CredentialFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const prefill = useRef<{ taken: boolean; secret: string | null }>({ taken: false, secret: null });
  const typeRef = useRef(type);
  const detailsRef = useRef<HTMLDivElement>(null);

  const dirty = type !== null && hasChanges(type, INITIAL_VALUES, values);
  const { requestLeave, dialog } = useLeaveGuard(dirty, projectHref);

  // One-shot Generator hand-off: consume the stored secret and drop the marker from the URL.
  useEffect(() => {
    if (prefill.current.taken) return;
    prefill.current = { taken: true, secret: takeGeneratorPrefill(searchParams) };
    if (searchParams.has("prefill")) router.replace(`${pathname}${withoutPrefillParam(searchParams)}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<ProjectInfo>(`/api/projects/${encodeURIComponent(projectId)}`)
      .then((project) => {
        if (cancelled) return;
        setLoad({ status: "ready", project: { name: project.name, currentUserRole: project.currentUserRole } });
        const preselected = typeRef.current;
        if (preselected) setValues((current) => applyPrefill(preselected, current, prefill.current.secret));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: "error", message: errorMessage(error, "The project couldn't be loaded.") });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, attempt]);

  const changeValues = (next: CredentialFormValues, nextType: ServiceType | null = type) => {
    setValues(next);
    if (submitted && nextType) setErrors(validateCredentialForm(nextType, next));
  };

  const selectService = (next: ServiceType) => {
    setType(next);
    typeRef.current = next;
    changeValues(applyPrefill(next, values, prefill.current.secret), next);

    const details = detailsRef.current;
    if (details && details.getBoundingClientRect().top > window.innerHeight * 0.6) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      details.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  };

  const submit = async () => {
    if (!type || saving) return;
    const nextErrors = validateCredentialForm(type, values);
    setSubmitted(true);
    setErrors(nextErrors);
    const invalidId = firstInvalidInputId(type, nextErrors);
    if (invalidId) {
      document.getElementById(invalidId)?.focus();
      return;
    }

    setSaving(true);
    try {
      const created = await apiRequest<{ id: string }>("/api/credentials", {
        method: "POST",
        body: buildCreatePayload(projectId, type, values),
      });
      notify.success(`Credential "${values.name.trim()}" saved`);
      router.push(`${projectHref}/credentials/${encodeURIComponent(created.id)}`);
    } catch (error) {
      notify.error(errorMessage(error, "The credential couldn't be saved."));
      setSaving(false);
    }
  };

  const project = load.status === "ready" ? load.project : null;
  const readOnly = project?.currentUserRole === "viewer";
  const service = type ? getServiceMetadata(type) : undefined;

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
  } else if (readOnly) {
    body = (
      <ViewerNotice backHref={projectHref}>
        Viewers can open and reveal credentials in this project but can&apos;t add new ones. Ask a project owner for
        editor access.
      </ViewerNotice>
    );
  } else {
    body = (
      <div className="flex flex-wrap items-start gap-6">
        <StepCard step={1} title="Choose a service" id="credential-service" className="flex-[1_1_420px]">
          <ServicePicker selected={type} onSelect={selectService} />
        </StepCard>

        <div ref={detailsRef} className="min-w-0 flex-[1_1_480px] scroll-mt-6">
          <StepCard
            step={2}
            id="credential-details"
            title={
              service ? (
                <>
                  <span
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${categoryTone(service.category)}`}
                    aria-hidden="true"
                  >
                    <ServiceIcon type={service.type} className="h-4 w-4" />
                  </span>
                  <span className="truncate">{service.label} details</span>
                </>
              ) : (
                "Details"
              )
            }
          >
            {type ? (
              <CredentialDetailsForm
                key={type}
                type={type}
                values={values}
                onChange={(next) => changeValues(next)}
                errors={errors}
                onSubmit={submit}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-12 text-center">
                <MousePointerClick className="h-6 w-6 text-muted" aria-hidden="true" />
                <p className="text-sm font-semibold text-ink">Choose a service first</p>
                <p className="max-w-xs text-[13px] text-muted">
                  The form shows the exact fields that service needs, like host, port and password.
                </p>
              </div>
            )}
          </StepCard>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FormHeader
        title="New credential"
        projectName={project?.name}
        onCancel={requestLeave}
        showSave={load.status === "ready" && !readOnly}
        saving={saving}
        saveDisabled={!type}
      />
      {body}
      {dialog}
    </div>
  );
}
