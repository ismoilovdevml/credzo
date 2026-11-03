"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { notify } from "@/components/Toast";
import { useSession } from "@/components/shell/SessionProvider";
import { PROJECT_CONFIG } from "@/lib/config/constants";
import { createProject } from "./api";
import { ScopeOption } from "./ScopeOption";

type Scope = "organization" | "personal";

const PROJECTS_HREF = "/dashboard/projects";
const CREATOR_ROLES = new Set(["owner", "admin", "member"]);

function validateName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Project name is required.";
  if (name.length < PROJECT_CONFIG.NAME_MIN_LENGTH) {
    return `Use at least ${PROJECT_CONFIG.NAME_MIN_LENGTH} characters.`;
  }
  if (name.length > PROJECT_CONFIG.NAME_MAX_LENGTH) {
    return `Use ${PROJECT_CONFIG.NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

function validateDescription(value: string): string | null {
  return value.trim().length > PROJECT_CONFIG.DESCRIPTION_MAX_LENGTH
    ? `Use ${PROJECT_CONFIG.DESCRIPTION_MAX_LENGTH} characters or fewer.`
    : null;
}

export function NewProjectForm() {
  const router = useRouter();
  const { organization, role, isPlatformAdmin, refreshProjectCount } = useSession();

  const canCreateInOrganization = Boolean(organization) && (isPlatformAdmin || (role !== null && CREATOR_ROLES.has(role)));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<Scope>(canCreateInOrganization ? "organization" : "personal");
  const [touched, setTouched] = useState({ name: false, description: false });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const nameError = validateName(name);
  const descriptionError = validateDescription(description);
  const effectiveScope: Scope = canCreateInOrganization ? scope : "personal";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setTouched({ name: true, description: true });
    if (nameError) {
      nameRef.current?.focus();
      return;
    }
    if (descriptionError) {
      descriptionRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setServerError(null);
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim(),
        organizationId: effectiveScope === "organization" && organization ? organization.id : null,
      });
      void refreshProjectCount();
      notify.success(`Project “${project.name}” created`);
      router.push(`${PROJECTS_HREF}/${project.id}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Couldn't create the project. Please try again.");
      setSubmitting(false);
    }
  };

  const organizationReason = !organization
    ? "You're not part of an organisation, so new projects are personal."
    : canCreateInOrganization
      ? undefined
      : `You're a viewer in ${organization.name}, so you can't create projects there. Ask an owner or admin for member access.`;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        back={{ href: PROJECTS_HREF, label: "Projects" }}
        title="New project"
        description="Group related credentials in one place and decide who can see them."
      />

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={submitting || undefined}>
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          >
            <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
            <span className="min-w-0 break-words">{serverError}</span>
          </div>
        )}

        <Card>
          <CardContent className="flex flex-col gap-[18px] p-5 sm:p-6">
            <Field
              id="project-name"
              label="Project name"
              required
              error={touched.name ? nameError : null}
              hint={`${PROJECT_CONFIG.NAME_MIN_LENGTH}–${PROJECT_CONFIG.NAME_MAX_LENGTH} characters.`}
            >
              <Input
                ref={nameRef}
                inputSize="lg"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                placeholder="e.g. Mobile app backend"
                autoComplete="off"
                autoFocus
                maxLength={PROJECT_CONFIG.NAME_MAX_LENGTH}
                disabled={submitting}
                data-testid="project-name-input"
              />
            </Field>

            <Field
              id="project-description"
              label="Description"
              optional
              error={touched.description ? descriptionError : null}
              hint={`${description.trim().length}/${PROJECT_CONFIG.DESCRIPTION_MAX_LENGTH} characters.`}
            >
              <Textarea
                ref={descriptionRef}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, description: true }))}
                placeholder="e.g. Push notifications, auth and API gateway"
                disabled={submitting}
                data-testid="project-description-input"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Who can see it" description="You'll be the project owner either way." />
          <CardContent className="p-5 sm:p-6">
            <fieldset disabled={submitting} className="flex flex-col gap-2.5">
              <legend className="sr-only">Who can see it</legend>
              <ScopeOption
                name="scope"
                value="organization"
                checked={effectiveScope === "organization"}
                onSelect={() => setScope("organization")}
                title={organization ? `Everyone in ${organization.name}` : "Organisation"}
                description="Owners and admins manage it, members can add and edit credentials, viewers can read them."
                disabledReason={organizationReason}
                testId="scope-organization"
              />
              <ScopeOption
                name="scope"
                value="personal"
                checked={effectiveScope === "personal"}
                onSelect={() => setScope("personal")}
                title="Personal"
                description="Only you, plus anyone you add as a project member later. Good for your own servers and keys."
                testId="scope-personal"
              />
            </fieldset>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="ghost" size="md">
            <Link href={PROJECTS_HREF}>Cancel</Link>
          </Button>
          <Button type="submit" size="md" loading={submitting} data-testid="create-project-submit">
            {submitting ? "Creating…" : "Create project"}
          </Button>
        </div>
      </form>
    </div>
  );
}
