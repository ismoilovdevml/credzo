/**
 * State, validation and request payloads shared by the new and edit credential screens.
 * Field values are kept as strings exactly as typed; the API stores every field as text.
 */

import { CREDENTIAL_CONFIG } from "@/lib/config/constants";
import { getServiceMetadata } from "@/lib/services";
import type { CredentialEnvironment, ServiceFieldDefinition, ServiceType } from "@/lib/types";
import { isSecretField } from "@/lib/utils/credentials";

export type EnvironmentChoice = CredentialEnvironment | "none";

export const ENVIRONMENT_OPTIONS: { value: EnvironmentChoice; label: string }[] = [
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "development", label: "Development" },
  { value: "none", label: "None" },
];

export const ROTATION_PRESETS = [30, 60, 90, 180] as const;

/** Credential detail as returned by GET /api/credentials/[id] (secret values omitted). */
export interface CredentialDetail {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  type: ServiceType;
  description: string;
  fields: Record<string, string>;
  secretFields: string[];
  environment: CredentialEnvironment | null;
  rotationDays: number | null;
  currentUserRole: string;
}

export interface CredentialFormValues {
  name: string;
  environment: EnvironmentChoice;
  /** Days as a string ("" = no reminder) so it can back a <select>. */
  rotation: string;
  description: string;
  fields: Record<string, string>;
}

export type FormErrors = Record<string, string>;

export const NAME_ERROR_KEY = "name";
export const fieldErrorKey = (fieldName: string) => `field:${fieldName}`;

/** DOM ids, also used to focus the first invalid control. */
export const NAME_INPUT_ID = "credential-name";
export const fieldInputId = (fieldName: string) => `credential-field-${fieldName}`;

export function serviceFields(type: ServiceType | null): ServiceFieldDefinition[] {
  return type ? (getServiceMetadata(type)?.fields ?? []) : [];
}

export function isSecret(type: ServiceType, field: ServiceFieldDefinition): boolean {
  return isSecretField(type, field.name);
}

export function emptyFormValues(): CredentialFormValues {
  return { name: "", environment: "none", rotation: "", description: "", fields: {} };
}

export function formValuesFromCredential(
  credential: CredentialDetail,
  secrets: Record<string, string>
): CredentialFormValues {
  const fields: Record<string, string> = {};
  for (const field of serviceFields(credential.type)) {
    fields[field.name] = credential.fields[field.name] ?? secrets[field.name] ?? "";
  }
  return {
    name: credential.name,
    environment: credential.environment ?? "none",
    rotation: credential.rotationDays === null ? "" : String(credential.rotationDays),
    description: credential.description,
    fields,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUrl(value: string): boolean {
  try {
    return Boolean(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateField(field: ServiceFieldDefinition, raw: string): string | null {
  const value = raw.trim();
  if (!value) return field.required ? `${field.label} is required` : null;

  if (raw.length > CREDENTIAL_CONFIG.FIELD_VALUE_MAX_LENGTH) return `${field.label} is too long`;
  if (field.type === "number") {
    if (!/^\d+$/.test(value)) return `${field.label} must be a whole number`;
    if (field.name === "port" && (Number(value) < 1 || Number(value) > 65535)) {
      return "Port must be between 1 and 65535";
    }
  }
  if (field.type === "url" && !isValidUrl(value)) return `Enter a full URL, e.g. ${field.placeholder || "https://example.com"}`;
  if (field.type === "email" && !EMAIL_PATTERN.test(value)) return "Enter a valid email address";
  return null;
}

export function validateCredentialForm(type: ServiceType, values: CredentialFormValues): FormErrors {
  const errors: FormErrors = {};
  const name = values.name.trim();
  if (!name) errors[NAME_ERROR_KEY] = "Name is required";
  else if (name.length > CREDENTIAL_CONFIG.NAME_MAX_LENGTH) {
    errors[NAME_ERROR_KEY] = `Name must be at most ${CREDENTIAL_CONFIG.NAME_MAX_LENGTH} characters`;
  }

  for (const field of serviceFields(type)) {
    const message = validateField(field, values.fields[field.name] ?? "");
    if (message) errors[fieldErrorKey(field.name)] = message;
  }
  return errors;
}

/** Id of the first invalid control in render order, for focusing after a failed submit. */
export function firstInvalidInputId(type: ServiceType, errors: FormErrors): string | null {
  if (errors[NAME_ERROR_KEY]) return NAME_INPUT_ID;
  const field = serviceFields(type).find((candidate) => errors[fieldErrorKey(candidate.name)]);
  return field ? fieldInputId(field.name) : null;
}

/** Secrets are stored verbatim; everything else is trimmed. */
function normalizeField(type: ServiceType, field: ServiceFieldDefinition, raw: string): string {
  return isSecret(type, field) ? raw : raw.trim();
}

const toEnvironment = (choice: EnvironmentChoice): CredentialEnvironment | null => (choice === "none" ? null : choice);
const toRotationDays = (rotation: string): number | null => (rotation ? Number(rotation) : null);

export function buildCreatePayload(projectId: string, type: ServiceType, values: CredentialFormValues) {
  const fields: Record<string, string> = {};
  for (const field of serviceFields(type)) {
    const value = normalizeField(type, field, values.fields[field.name] ?? "");
    if (value.trim()) fields[field.name] = value;
  }
  return {
    projectId,
    name: values.name.trim(),
    type,
    description: values.description.trim(),
    fields,
    environment: toEnvironment(values.environment),
    rotationDays: toRotationDays(values.rotation),
  };
}

export interface CredentialPatch {
  name?: string;
  description?: string;
  environment?: CredentialEnvironment | null;
  rotationDays?: number | null;
  /** Changed keys only: a value sets the field, null clears it. */
  fields?: Record<string, string | null>;
}

/** Only what differs from the initial values; empty when nothing changed. */
export function buildPatch(type: ServiceType, initial: CredentialFormValues, values: CredentialFormValues): CredentialPatch {
  const patch: CredentialPatch = {};
  const name = values.name.trim();
  if (name !== initial.name) patch.name = name;
  const description = values.description.trim();
  if (description !== initial.description) patch.description = description;
  if (values.environment !== initial.environment) patch.environment = toEnvironment(values.environment);
  if (values.rotation !== initial.rotation) patch.rotationDays = toRotationDays(values.rotation);

  const fields: Record<string, string | null> = {};
  for (const field of serviceFields(type)) {
    const before = initial.fields[field.name] ?? "";
    const after = normalizeField(type, field, values.fields[field.name] ?? "");
    if (after === before) continue;
    fields[field.name] = after.trim() ? after : null;
  }
  if (Object.keys(fields).length > 0) patch.fields = fields;
  return patch;
}

/** True when any visible value differs from the starting point (drives the unsaved-changes guard). */
export function hasChanges(type: ServiceType | null, initial: CredentialFormValues, values: CredentialFormValues): boolean {
  if (
    values.name !== initial.name ||
    values.description !== initial.description ||
    values.environment !== initial.environment ||
    values.rotation !== initial.rotation
  ) {
    return true;
  }
  return serviceFields(type).some((field) => (values.fields[field.name] ?? "") !== (initial.fields[field.name] ?? ""));
}
