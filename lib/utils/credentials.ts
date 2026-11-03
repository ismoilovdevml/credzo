/**
 * Credential input parsing and client-facing views.
 *
 * Secret field values never leave the server through list/detail endpoints:
 * views carry non-secret fields (host, username, ...) plus the names of secret
 * fields that hold a value. Secrets are only returned by the audited reveal endpoint.
 */

import type { ProjectRef } from '@/lib/authorization';
import { CREDENTIAL_CONFIG } from '@/lib/config/constants';
import { SERVICE_DEFINITIONS, getServiceMetadata } from '@/lib/services';
import { CREDENTIAL_ENVIRONMENTS } from '@/lib/types';
import type { Credential, CredentialEnvironment, ServiceType } from '@/lib/types';
import { ValidationError } from './errors';
import {
  type JsonObject,
  isPlainObject,
  readNullableEnum,
  readNullableInteger,
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
} from './input';


/** Fields whose metadata type is not "password" but whose value is still a secret. */
const SECRET_FIELD_NAMES = new Set([
  'privateKey',
  'kubeconfig',
  'keyFile',
  'serviceAccountKey',
  'tlsKey',
  'webhookUrl',
  'headers',
]);

/** Fallback for custom fields that have no service metadata. */
const SECRET_FIELD_PATTERN = /pass(word|phrase)?|secret|token|private|api[-_]?key|credential/i;

const FIELD_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

const SERVICE_TYPES: readonly string[] = SERVICE_DEFINITIONS.map((service) => service.type);

export function isSecretField(type: string, name: string): boolean {
  if (SECRET_FIELD_NAMES.has(name)) return true;
  const definition = getServiceMetadata(type as ServiceType)?.fields.find((field) => field.name === name);
  if (definition) return definition.type === 'password';
  return SECRET_FIELD_PATTERN.test(name);
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export interface CredentialView {
  id: string;
  projectId: string;
  /** Organization of the owning project; null for personal projects. */
  organizationId: string | null;
  name: string;
  type: ServiceType;
  description: string;
  /** Non-secret field values only. */
  fields: Record<string, string>;
  /** Names of secret fields that hold a value; fetch them via POST /api/credentials/[id]/reveal. */
  secretFields: string[];
  linkedServers: string[];
  environment: CredentialEnvironment | null;
  rotationDays: number | null;
  lastRotatedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toCredentialView(
  credential: Credential,
  project: Pick<ProjectRef, 'id' | 'organizationId'>
): CredentialView {
  const fields: Record<string, string> = {};
  const secretFields: string[] = [];

  for (const [name, value] of Object.entries(credential.fields ?? {})) {
    if (!hasValue(value)) continue;
    if (isSecretField(credential.type, name)) {
      secretFields.push(name);
    } else {
      fields[name] = value;
    }
  }

  return {
    id: credential.id,
    projectId: project.id,
    organizationId: project.organizationId,
    name: credential.name,
    type: credential.type,
    description: credential.description ?? '',
    fields,
    secretFields,
    linkedServers: credential.linkedServers ?? [],
    environment: credential.environment ?? null,
    rotationDays: credential.rotationDays ?? null,
    lastRotatedAt: credential.lastRotatedAt ?? null,
    createdBy: credential.createdBy,
    createdAt: credential.createdAt,
    updatedBy: credential.updatedBy ?? null,
    updatedAt: credential.updatedAt,
  };
}

/** Secret field values of a credential, keyed by field name. */
export function getSecretFieldValues(credential: Credential): Record<string, string> {
  const secrets: Record<string, string> = {};
  for (const [name, value] of Object.entries(credential.fields ?? {})) {
    if (hasValue(value) && isSecretField(credential.type, name)) {
      secrets[name] = value;
    }
  }
  return secrets;
}

/** Case-insensitive match on name, description, type, environment, servers and non-secret fields. */
export function credentialMatchesQuery(view: CredentialView, query: string): boolean {
  const needle = query.toLowerCase();
  const haystack = [
    view.name,
    view.description,
    view.type,
    view.environment ?? '',
    ...view.linkedServers,
    ...Object.values(view.fields),
  ];
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

// ===== Input parsing =====

export interface CredentialInput {
  name: string;
  type: ServiceType;
  description: string;
  fields: Record<string, string>;
  linkedServers: string[];
  environment: CredentialEnvironment | null;
  rotationDays: number | null;
}

export interface CredentialPatch {
  name?: string;
  type?: ServiceType;
  description?: string;
  /** Field updates: a value sets the field, null removes it, absent fields are kept. */
  fields?: Record<string, string | null>;
  linkedServers?: string[];
  environment?: CredentialEnvironment | null;
  rotationDays?: number | null;
}

function readServiceType(body: JsonObject, required: boolean): ServiceType | undefined {
  const value = body.type;
  if (value === undefined || value === null) {
    if (required) throw new ValidationError('Credential type is required');
    return undefined;
  }
  if (typeof value !== 'string' || !SERVICE_TYPES.includes(value)) {
    throw new ValidationError('Credential type is not a supported service type');
  }
  return value as ServiceType;
}

/** Field values are stored as text; numbers and booleans are accepted and stringified. */
function readFieldValue(name: string, value: unknown): string {
  if (typeof value === 'string') {
    if (value.length > CREDENTIAL_CONFIG.FIELD_VALUE_MAX_LENGTH) {
      throw new ValidationError(`Field "${name}" is too long`);
    }
    return value;
  }
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
    return String(value);
  }
  throw new ValidationError(`Field "${name}" must be text, a number or a boolean`);
}

function readFieldsObject(body: JsonObject, allowNull: boolean): Record<string, string | null> | undefined {
  const value = body.fields;
  if (value === undefined || value === null) return undefined;
  if (!isPlainObject(value)) {
    throw new ValidationError('Fields must be an object');
  }
  const entries = Object.entries(value);
  if (entries.length > CREDENTIAL_CONFIG.MAX_FIELDS) {
    throw new ValidationError(`A credential can have at most ${CREDENTIAL_CONFIG.MAX_FIELDS} fields`);
  }

  const fields: Record<string, string | null> = {};
  for (const [name, fieldValue] of entries) {
    if (name.length > CREDENTIAL_CONFIG.FIELD_NAME_MAX_LENGTH || !FIELD_NAME_PATTERN.test(name)) {
      throw new ValidationError(`Field name "${name.slice(0, 64)}" is invalid`);
    }
    if (fieldValue === null && allowNull) {
      fields[name] = null;
    } else {
      fields[name] = readFieldValue(name, fieldValue);
    }
  }
  return fields;
}

function readCommonOptionalFields(body: JsonObject) {
  return {
    description: readOptionalString(body, 'description', 'Description', {
      max: CREDENTIAL_CONFIG.DESCRIPTION_MAX_LENGTH,
    }),
    linkedServers: readOptionalStringArray(body, 'linkedServers', 'Linked servers', {
      maxItems: CREDENTIAL_CONFIG.MAX_LINKED_SERVERS,
      maxLength: CREDENTIAL_CONFIG.LINKED_SERVER_MAX_LENGTH,
    }),
    environment: readNullableEnum(body, 'environment', 'Environment', CREDENTIAL_ENVIRONMENTS),
    rotationDays: readNullableInteger(body, 'rotationDays', 'Rotation interval (days)', {
      min: CREDENTIAL_CONFIG.ROTATION_DAYS_MIN,
      max: CREDENTIAL_CONFIG.ROTATION_DAYS_MAX,
    }),
  };
}

const NAME_OPTIONS = { min: CREDENTIAL_CONFIG.NAME_MIN_LENGTH, max: CREDENTIAL_CONFIG.NAME_MAX_LENGTH };

export function parseCredentialInput(body: JsonObject): CredentialInput {
  const name = readRequiredString(body, 'name', 'Credential name', NAME_OPTIONS);
  const type = readServiceType(body, true) as ServiceType;
  const common = readCommonOptionalFields(body);
  const fields = (readFieldsObject(body, false) ?? {}) as Record<string, string>;

  return {
    name,
    type,
    description: common.description ?? '',
    fields,
    linkedServers: common.linkedServers ?? [],
    environment: common.environment ?? null,
    rotationDays: common.rotationDays ?? null,
  };
}

export function parseCredentialPatch(body: JsonObject): CredentialPatch {
  const name = readOptionalString(body, 'name', 'Credential name', NAME_OPTIONS);
  if (name === '') throw new ValidationError('Credential name cannot be empty');

  const patch: CredentialPatch = {
    name,
    type: readServiceType(body, false),
    ...readCommonOptionalFields(body),
    fields: readFieldsObject(body, true),
  };

  const hasChanges = Object.values(patch).some((value) => value !== undefined);
  if (!hasChanges) throw new ValidationError('No changes provided');
  return patch;
}

/** Apply a field patch on top of the stored fields. */
export function mergeFields(
  current: Record<string, string>,
  patch: Record<string, string | null>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [name, value] of Object.entries(current)) {
    if (hasValue(value)) merged[name] = value;
  }
  for (const [name, value] of Object.entries(patch)) {
    if (value === null) delete merged[name];
    else merged[name] = value;
  }
  if (Object.keys(merged).length > CREDENTIAL_CONFIG.MAX_FIELDS) {
    throw new ValidationError(`A credential can have at most ${CREDENTIAL_CONFIG.MAX_FIELDS} fields`);
  }
  return merged;
}
