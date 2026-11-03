"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Eye, Save } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button, Card, EmptyState, IconButton, PageHeader, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { CREDENTIAL_FORM_ID } from "./CredentialDetailsForm";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

/** Leaving the form: confirms Back/Cancel and browser unloads while there are unsaved changes. */
export function useLeaveGuard(dirty: boolean, backHref: string) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  useUnsavedChangesGuard(dirty);

  const requestLeave = () => {
    if (dirty) setConfirming(true);
    else router.push(backHref);
  };

  const dialog = (
    <ConfirmDialog
      isOpen={confirming}
      onClose={() => setConfirming(false)}
      onConfirm={() => router.push(backHref)}
      title="Discard unsaved changes?"
      message="The changes you made on this page will be lost."
      confirmText="Discard changes"
      cancelText="Keep editing"
      variant="warning"
    />
  );

  return { requestLeave, dialog };
}

interface FormHeaderProps {
  title: string;
  projectName?: string;
  onCancel: () => void;
  /** Hide Save (viewer / error states). */
  showSave: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
}

/** Page header with back, Cancel and a Save button that submits the credential form. */
export function FormHeader({ title, projectName, onCancel, showSave, saving, saveDisabled, saveLabel = "Save credential" }: FormHeaderProps) {
  return (
    <PageHeader
      title={title}
      description={projectName ? `in ${projectName}` : undefined}
      leading={
        <IconButton label="Back" variant="secondary" size="lg" onClick={onCancel} data-testid="credential-form-back">
          <ArrowLeft />
        </IconButton>
      }
      actions={
        <>
          <Button variant="ghost" onClick={onCancel} data-testid="cancel-credential">
            Cancel
          </Button>
          {showSave && (
            <Button
              type="submit"
              form={CREDENTIAL_FORM_ID}
              loading={saving}
              disabled={saveDisabled}
              leftIcon={<Save />}
              data-testid="save-credential"
            >
              {saveLabel}
            </Button>
          )}
        </>
      }
    />
  );
}

/** Numbered section card (mockup: "1 Choose a service", "2 PostgreSQL details"). */
export function StepCard({
  step,
  title,
  children,
  className,
  id,
}: {
  step?: number;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Card id={id} aria-labelledby={headingId} role="region" className={cn("flex flex-col gap-4 p-5 sm:p-6", className)}>
      <div className="flex items-center gap-2.5">
        {step !== undefined && (
          <span
            className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-accent text-[13px] font-bold text-on-accent"
            aria-hidden="true"
          >
            {step}
          </span>
        )}
        <h2 id={headingId} className="flex min-w-0 items-center gap-2 text-base font-bold text-ink">
          {title}
        </h2>
      </div>
      {children}
    </Card>
  );
}

export function ViewerNotice({ backHref, children }: { backHref: string; children: ReactNode }) {
  return (
    <EmptyState
      icon={<Eye />}
      title="You have read-only access"
      description={children}
      action={
        <Button variant="secondary" asChild>
          <Link href={backHref}>Go back</Link>
        </Button>
      }
      className="max-w-2xl"
    />
  );
}

export function LoadError({ message, onRetry, backHref }: { message: string; onRetry?: () => void; backHref: string }) {
  return (
    <EmptyState
      icon={<AlertTriangle />}
      title="This page couldn't be loaded"
      description={message}
      action={
        <>
          {onRetry && <Button onClick={onRetry}>Try again</Button>}
          <Button variant="secondary" asChild>
            <Link href={backHref}>Go back</Link>
          </Button>
        </>
      }
    />
  );
}

export function FormSkeleton() {
  return (
    <Card className="flex flex-col gap-5 p-6" role="status" aria-busy="true" aria-label="Loading credential form">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </Card>
  );
}
