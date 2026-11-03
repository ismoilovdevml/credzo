"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

export type DialogVariant = "danger" | "warning" | "info";

const VARIANTS = {
  danger: { icon: AlertTriangle, tone: "bg-danger-soft text-danger", button: "danger" },
  warning: { icon: AlertTriangle, tone: "bg-warn-soft text-warn", button: "primary" },
  info: { icon: Info, tone: "bg-info-soft text-info", button: "primary" },
} as const;

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** May return a promise: the dialog shows a spinner and stays open until it settles, then closes. */
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  /** Bullet list under the message (e.g. what will be deleted). */
  details?: string[];
}

/** Confirmation prompt built on Modal. The cancel button gets initial focus so Enter never confirms by accident. */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  details = [],
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const config = VARIANTS[variant];
  const Icon = config.icon;

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      role={variant === "danger" ? "alertdialog" : "dialog"}
      title={title}
      initialFocusRef={cancelRef}
      dismissible={!pending}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={pending}>
            {cancelText}
          </Button>
          <Button variant={config.button} onClick={handleConfirm} loading={pending}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3.5">
        <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-xl", config.tone)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-[14.5px] leading-relaxed text-ink-2">{message}</p>
          {details.length > 0 && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] text-ink-2 marker:text-muted">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
