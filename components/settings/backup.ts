/**
 * Backup file format. An encrypted backup is a small JSON envelope whose `data`
 * is the export payload encrypted with lib/crypto.ts (PBKDF2-SHA256 → AES-256-GCM,
 * base64 of salt ‖ iv ‖ ciphertext). Plain exports (`{ projects: [...] }` or a
 * bare array) and the legacy raw-base64 ".credzo" files are accepted on import.
 */

export const BACKUP_FORMAT = "credzo-backup";

/** Matches the 5 MB server limit for the decrypted payload, plus base64 and envelope overhead. */
export const MAX_BACKUP_FILE_BYTES = 8 * 1024 * 1024;

export interface ExportPayload {
  type: "full" | "partial";
  version: string;
  exportedAt: string;
  projects: { name: string; credentials: unknown[] }[];
}

export interface EncryptedBackup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  encryption: "AES-256-GCM, PBKDF2-SHA256 (100,000 iterations)";
  exportedAt: string;
  data: string;
}

export type ParsedBackup =
  | { kind: "encrypted"; ciphertext: string; exportedAt: string | null }
  | { kind: "plain"; payload: unknown; projects: number; credentials: number };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildEncryptedBackup(ciphertext: string, exportedAt: string): EncryptedBackup {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    encryption: "AES-256-GCM, PBKDF2-SHA256 (100,000 iterations)",
    exportedAt,
    data: ciphertext,
  };
}

/** The projects list of an export payload (`{ projects }` or a bare array), or null if it isn't one. */
export function exportProjects(payload: unknown): unknown[] | null {
  const projects = isObject(payload) ? payload.projects : payload;
  return Array.isArray(projects) ? projects : null;
}

export function countCredentials(projects: unknown[]): number {
  return projects.reduce<number>(
    (total, project) => total + (isObject(project) && Array.isArray(project.credentials) ? project.credentials.length : 0),
    0
  );
}

/** Classifies a chosen file's text. Throws with a user-facing message when it isn't a Credzo backup. */
export function parseBackupFile(text: string): ParsedBackup {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The file is empty.");

  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    // Legacy exports were the raw base64 ciphertext without an envelope.
    if (BASE64.test(trimmed.replace(/\s+/g, ""))) {
      return { kind: "encrypted", ciphertext: trimmed.replace(/\s+/g, ""), exportedAt: null };
    }
    throw new Error("This file isn't valid JSON. Choose a Credzo backup (.json).");
  }

  if (isObject(json) && json.format === BACKUP_FORMAT) {
    if (typeof json.data !== "string" || !json.data) throw new Error("This backup is missing its encrypted data.");
    return {
      kind: "encrypted",
      ciphertext: json.data,
      exportedAt: typeof json.exportedAt === "string" ? json.exportedAt : null,
    };
  }

  const projects = exportProjects(json);
  if (!projects) throw new Error("This file isn't a Credzo export. Expected a list of projects.");
  if (projects.length === 0) throw new Error("This export contains no projects.");
  return { kind: "plain", payload: json, projects: projects.length, credentials: countCredentials(projects) };
}
