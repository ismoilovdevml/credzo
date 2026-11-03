/**
 * Types and pure helpers for the project detail screen.
 */

import type { ProjectRole } from "@/lib/authorization";
import { getServiceMetadata } from "@/lib/services";
import type { CredentialEnvironment, OrganizationMember, ServiceType } from "@/lib/types";
import type { CredentialView } from "@/lib/utils/credentials";
import type { ProjectMemberView, ProjectSummary, UserSummary } from "@/lib/utils/projects";
import type { BadgeTone } from "@/components/ui";

export type { CredentialView, ProjectMemberView, ProjectRole, ProjectSummary, UserSummary };

/** GET /api/projects/[id] */
export interface ProjectDetail extends ProjectSummary {
  owner: UserSummary | null;
  members: ProjectMemberView[];
  credentials: CredentialView[];
}

/** GET /api/organizations/[id]/members item. */
export type OrganizationMemberView = OrganizationMember & { user: UserSummary | null };

export const PROJECT_ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "owner", label: "Owner" },
];

const ROLE_LABELS: Record<string, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };
const ROLE_TONES: Record<string, BadgeTone> = { owner: "accent", editor: "info", viewer: "neutral" };

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function roleTone(role: string): BadgeTone {
  return ROLE_TONES[role] ?? "neutral";
}

export function canEditProject(role: ProjectRole): boolean {
  return role === "owner" || role === "editor";
}

export function canManageProject(role: ProjectRole): boolean {
  return role === "owner";
}

export function userName(user: UserSummary): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.username;
}

export function credentialUrl(projectId: string, credentialId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/credentials/${encodeURIComponent(credentialId)}`;
}

export function serviceLabel(type: string): string {
  return getServiceMetadata(type as ServiceType)?.label ?? type;
}

// ===== Environments =====

export type EnvironmentFilter = "all" | CredentialEnvironment;

export const ENVIRONMENT_TABS: { value: EnvironmentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "development", label: "Development" },
];

export function countByEnvironment(credentials: CredentialView[]): Record<EnvironmentFilter, number> {
  const counts: Record<EnvironmentFilter, number> = {
    all: credentials.length,
    production: 0,
    staging: 0,
    development: 0,
  };
  for (const credential of credentials) {
    if (credential.environment) counts[credential.environment] += 1;
  }
  return counts;
}

// ===== Display helpers =====

const DAY_MS = 24 * 60 * 60 * 1000;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** Compact past-relative time: "just now", "5m ago", "3h ago", "12d ago", "4mo ago", "2y ago". */
export function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Fields that identify where a credential points, in order of preference. */
const SUMMARY_FIELDS = [
  "url",
  "endpoint",
  "apiUrl",
  "apiServer",
  "serverUrl",
  "uri",
  "address",
  "elasticsearchUrl",
  "brokers",
  "servers",
  "endpoints",
  "contactPoints",
  "server",
  "repository",
  "bucket",
  "region",
  "accountId",
  "accountName",
  "subscriptionId",
  "projectId",
  "organization",
  "clientId",
  "username",
  "email",
];

/** One-line, non-secret description of a credential: "user@host:port", an endpoint, or the first plain field. */
export function credentialSummary(credential: CredentialView): string {
  const { fields } = credential;
  const host = fields.host ?? fields.hostname;
  if (host) {
    const user = fields.username ?? fields.user;
    return `${user ? `${user}@` : ""}${host}${fields.port ? `:${fields.port}` : ""}`;
  }
  for (const name of SUMMARY_FIELDS) {
    if (fields[name]) return fields[name];
  }
  const firstLine = Object.values(fields).find((value) => value && !value.includes("\n"));
  return firstLine ?? "";
}

/** Secret fields tried first when copying "the" secret of a credential. */
const PRIMARY_SECRET_FIELDS = [
  "password",
  "token",
  "apiKey",
  "apiToken",
  "accessToken",
  "secret",
  "secretKey",
  "secretAccessKey",
  "clientSecret",
  "botToken",
  "authToken",
  "privateKey",
];

export function primarySecretField(credential: CredentialView): string | null {
  const preferred = PRIMARY_SECRET_FIELDS.find((name) => credential.secretFields.includes(name));
  return preferred ?? credential.secretFields[0] ?? null;
}

export function fieldLabel(type: string, name: string): string {
  return getServiceMetadata(type as ServiceType)?.fields.find((field) => field.name === name)?.label ?? name;
}

// ===== Rotation =====

export type RotationState = "none" | "ok" | "soon" | "overdue";

export interface RotationStatus {
  state: RotationState;
  label: string;
}

/**
 * Rotation status from the policy interval and the last rotation (or creation) date.
 * "soon" starts a quarter of the interval before the due date, capped at 14 days.
 */
export function rotationStatus(credential: CredentialView, now: number): RotationStatus {
  if (!credential.rotationDays) return { state: "none", label: "No policy" };

  const since = new Date(credential.lastRotatedAt ?? credential.createdAt).getTime();
  const ageDays = Math.max(0, Math.floor((now - since) / DAY_MS));
  const remaining = credential.rotationDays - ageDays;

  if (remaining < 0) return { state: "overdue", label: `Overdue ${plural(-remaining, "day")}` };
  if (remaining <= Math.min(14, Math.ceil(credential.rotationDays / 4))) {
    return { state: "soon", label: remaining === 0 ? "Due today" : `Due in ${plural(remaining, "day")}` };
  }
  return { state: "ok", label: ageDays === 0 ? "Rotated today" : `Rotated ${ageDays}d ago` };
}

export const ROTATION_TEXT: Record<RotationState, string> = {
  none: "text-muted",
  ok: "text-success",
  soon: "text-warn",
  overdue: "text-danger",
};
