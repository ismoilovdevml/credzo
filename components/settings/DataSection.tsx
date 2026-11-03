"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Download, FileJson, Lock, Upload } from "lucide-react";
import { Button, Card, CardTitle, Field, Modal } from "@/components/ui";
import { notify } from "@/components/Toast";
import { useSession } from "@/components/shell/SessionProvider";
import { decryptData, encryptData } from "@/lib/crypto";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/api-client";
import { errorMessage } from "./api";
import {
  buildEncryptedBackup,
  countCredentials,
  exportProjects,
  MAX_BACKUP_FILE_BYTES,
  parseBackupFile,
  type ExportPayload,
  type ParsedBackup,
} from "./backup";
import { PasswordInput, StrengthMeter } from "./controls";
import { downloadFile, formatBytes, formatDateTime, isoDay } from "./format";

const MIN_PASSPHRASE = 10;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Asks for a passphrase, exports every readable project and downloads it encrypted. */
function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ passphrase?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPassphrase("");
    setConfirm("");
    setErrors({});
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (passphrase.length < MIN_PASSPHRASE) found.passphrase = `Use at least ${MIN_PASSPHRASE} characters`;
    else if (confirm !== passphrase) found.confirm = "Passphrases don't match";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const data = await api.post<ExportPayload>("/api/projects/export", {});
      const projects = exportProjects(data) ?? [];
      if (projects.length === 0) {
        notify.info("There are no projects to export yet");
        reset();
        onClose();
        return;
      }
      const ciphertext = await encryptData(JSON.stringify(data), passphrase);
      const backup = buildEncryptedBackup(ciphertext, data.exportedAt);
      downloadFile(JSON.stringify(backup, null, 2), `credzo-backup-${isoDay()}.json`, "application/json");
      notify.success(
        `Backup downloaded: ${plural(projects.length, "project")}, ${plural(countCredentials(projects), "credential")}`
      );
      reset();
      onClose();
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't create the backup"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!busy}
      size="sm"
      title="Export an encrypted backup"
      description="Includes every project you can access, organisation projects too. The passphrase can't be recovered — without it the file is unreadable."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="export-form" loading={busy} leftIcon={<Download />} data-testid="export-submit">
            Encrypt and download
          </Button>
        </>
      }
    >
      <form id="export-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Field label="Encryption passphrase" error={errors.passphrase} hint={`At least ${MIN_PASSPHRASE} characters.`}>
            <PasswordInput
              data-testid="export-passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <StrengthMeter password={passphrase} />
        </div>
        <Field label="Confirm passphrase" error={errors.confirm}>
          <PasswordInput
            data-testid="export-passphrase-confirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </form>
    </Modal>
  );
}

interface SelectedFile {
  name: string;
  size: number;
  backup: ParsedBackup;
}

/** Confirms an import; asks for the passphrase when the file is encrypted. */
function ImportModal({
  file,
  destination,
  onClose,
  onImported,
}: {
  file: SelectedFile | null;
  destination: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const backup = file?.backup;

  const close = () => {
    if (busy) return;
    setPassphrase("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!backup) return;

    let payload: unknown;
    if (backup.kind === "encrypted") {
      if (!passphrase) {
        setError("Enter the passphrase used for this backup");
        return;
      }
      setBusy(true);
      try {
        payload = JSON.parse(await decryptData(backup.ciphertext, passphrase));
      } catch {
        setError("Wrong passphrase, or the file is damaged.");
        setBusy(false);
        return;
      }
      if (!exportProjects(payload)) {
        setError("The backup decrypted, but it doesn't contain a project list.");
        setBusy(false);
        return;
      }
    } else {
      payload = backup.payload;
    }

    setBusy(true);
    try {
      const result = await api.post<{ projects: number; credentials: number }>("/api/import", payload);
      notify.success(`Imported ${plural(result.projects, "project")} and ${plural(result.credentials, "credential")}`);
      onImported();
      setPassphrase("");
      setError(null);
      onClose();
    } catch (importError) {
      setError(errorMessage(importError, "Import failed. Nothing was imported."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={file !== null}
      onClose={close}
      dismissible={!busy}
      size="sm"
      title="Import backup"
      description={`Projects are added to ${destination}. The import is all-or-nothing.`}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="import-form" loading={busy} leftIcon={<Upload />} data-testid="import-submit">
            Import
          </Button>
        </>
      }
    >
      {file && backup && (
        <form id="import-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
              {backup.kind === "encrypted" ? <Lock className="h-[18px] w-[18px]" aria-hidden="true" /> : <FileJson className="h-[18px] w-[18px]" aria-hidden="true" />}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14.5px] font-semibold text-ink">{file.name}</span>
              <span className="text-[13px] text-muted">
                {formatBytes(file.size)} ·{" "}
                {backup.kind === "encrypted"
                  ? `Encrypted${backup.exportedAt ? ` · exported ${formatDateTime(backup.exportedAt)}` : ""}`
                  : `${plural(backup.projects, "project")}, ${plural(backup.credentials, "credential")} · not encrypted`}
              </span>
            </span>
          </div>
          {backup.kind === "encrypted" ? (
            <Field label="Backup passphrase" error={error}>
              <PasswordInput
                data-testid="import-passphrase"
                value={passphrase}
                onChange={(event) => {
                  setPassphrase(event.target.value);
                  setError(null);
                }}
                autoComplete="off"
              />
            </Field>
          ) : (
            error && (
              <p role="alert" className="text-[13.5px] font-medium text-danger">
                {error}
              </p>
            )
          )}
        </form>
      )}
    </Modal>
  );
}

/** Export an encrypted backup and import one (or a plain export) back. */
export function DataSection() {
  const { organization, role, refreshProjectCount } = useSession();
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const destination = organization && role !== "viewer" ? organization.name : "your personal projects";

  const handleFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      notify.error(`That file is too large (${formatBytes(file.size)}). Backups can be up to 5 MB.`);
      return;
    }
    try {
      const backup = parseBackupFile(await file.text());
      setSelected({ name: file.name, size: file.size, backup });
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't read that file"));
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  };

  return (
    <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
      <CardTitle className="sm:col-span-2">
        Import &amp; export
      </CardTitle>

      <div className="flex flex-col gap-2.5 rounded-xl border border-line p-4">
        <h3 className="text-[15px] font-semibold text-ink">Export a backup</h3>
        <p className="flex-1 text-[14px] leading-relaxed text-muted">
          Download all projects and credentials as an encrypted JSON file.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          leftIcon={<Download />}
          data-testid="export-button"
          onClick={() => setExportOpen(true)}
        >
          Export
        </Button>
      </div>

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent/60 hover:bg-surface-2"
        )}
      >
        <Upload className="h-[22px] w-[22px] text-accent-ink" aria-hidden="true" />
        <span className="text-[15px] font-semibold text-ink">Import from JSON</span>
        <span className="text-[13.5px] text-muted">Drop a file or click to browse</span>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.credzo,application/json"
          data-testid="import-file"
          className="sr-only"
          onChange={(event: ChangeEvent<HTMLInputElement>) => void handleFile(event.target.files?.[0])}
        />
      </label>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <ImportModal
        file={selected}
        destination={destination}
        onClose={() => setSelected(null)}
        onImported={() => void refreshProjectCount()}
      />
    </Card>
  );
}
