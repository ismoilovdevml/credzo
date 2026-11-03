// ===== Enums =====

export enum UserRole {
  PLATFORM_ADMIN = "platform_admin",
  USER = "user",
}

export enum OrganizationRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer",
}

export enum AuditAction {
  CREATED = "created",
  UPDATED = "updated",
  DELETED = "deleted",
  ACCESSED = "accessed",
  INVITED = "invited",
  REMOVED = "removed",
  ROLE_CHANGED = "role_changed",
  LOGIN = "login",
  LOGOUT = "logout",
  LOGIN_FAILED = "login_failed",
  REVEALED = "revealed",
  COPIED = "copied",
  EXPORTED = "exported",
  PASSWORD_CHANGED = "password_changed",
  TWO_FACTOR_ENABLED = "2fa_enabled",
  TWO_FACTOR_DISABLED = "2fa_disabled",
  SESSION_REVOKED = "session_revoked",
  SHARE_CREATED = "share_created",
  SHARE_REVOKED = "share_revoked",
  SHARE_OPENED = "share_opened",
}

export enum AuditResource {
  PROJECT = "project",
  CREDENTIAL = "credential",
  MEMBER = "member",
  ORGANIZATION = "organization",
  USER = "user",
  SESSION = "session",
  ACCOUNT = "account",
  SHARE = "share",
}

export enum InvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

// ===== User & Authentication =====

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole | string;
  avatarUrl?: string;
  isVerified: boolean;
  totpEnabled: boolean;
  /** Number of unused two-factor backup codes (never the codes themselves). */
  backupCodesRemaining: number;
  jobTitle?: string;
  timezone?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

/** User shape that is safe to send to clients. */
export type PublicUser = Omit<User, "passwordHash">;

export interface Session {
  id: string;
  userId: string;
  /** SHA-256 of the session token; the raw token only ever lives in the cookie. */
  tokenHash: string;
  /** "Keep me signed in" sessions use a longer sliding expiry. */
  persistent: boolean;
  expiresAt: string;
  createdAt: string;
  lastActivity: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Session as listed to its owner in account settings. */
export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ip: string | null;
  lastActivity: string;
  createdAt: string;
  current: boolean;
}

// ===== Organization =====

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole | string;
  invitedBy?: string;
  invitedAt?: string;
  joinedAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole | string;
  invitedBy: string;
  token: string;
  status: InvitationStatus | string;
  expiresAt: string;
  createdAt: string;
  respondedAt?: string;
}

// ===== Audit =====

export interface AuditLog {
  id: string;
  organizationId?: string;
  /** Empty string when the actor is unknown (failed sign-in) or has been deleted. */
  userId: string;
  action: AuditAction | string;
  resourceType: AuditResource | string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// ===== Service Types =====

export type ServiceType =
  // Servers & Infrastructure
  | "vm-server"
  | "ssh-server"
  | "ftp"
  | "sftp"

  // Databases
  | "postgresql"
  | "mysql"
  | "mongodb"
  | "redis"
  | "mariadb"
  | "cassandra"
  | "elasticsearch"
  | "influxdb"
  | "timescaledb"
  | "clickhouse"
  | "couchdb"
  | "neo4j"

  // Message Queues & Streaming
  | "rabbitmq"
  | "kafka"
  | "nats"
  | "activemq"
  | "redis-queue"

  // Object Storage & CDN
  | "minio"
  | "aws-s3"
  | "azure-blob"
  | "google-cloud-storage"
  | "cloudflare"

  // CI/CD
  | "jenkins"
  | "gitlab-ci"
  | "github-actions"
  | "circleci"
  | "travis-ci"
  | "argocd"
  | "teamcity"

  // Container & Orchestration
  | "docker"
  | "kubernetes"
  | "docker-registry"
  | "harbor"
  | "rancher"
  | "openshift"

  // Monitoring & Logging
  | "prometheus"
  | "grafana"
  | "datadog"
  | "new-relic"
  | "elk-stack"
  | "splunk"
  | "sentry"

  // Caching
  | "memcached"
  | "varnish"

  // Reverse Proxy & Load Balancer
  | "nginx"
  | "apache"
  | "traefik"
  | "haproxy"
  | "caddy"

  // Version Control
  | "github"
  | "gitlab"
  | "bitbucket"

  // Cloud Providers
  | "aws"
  | "azure"
  | "gcp"
  | "digitalocean"
  | "linode"
  | "heroku"

  // Configuration & Secret Management
  | "ansible"
  | "terraform"
  | "consul"
  | "vault"
  | "etcd"

  // Communication
  | "smtp"
  | "slack"
  | "discord"
  | "telegram"

  // Authentication
  | "ldap"
  | "oauth"
  | "jwt-secret"
  | "api-key"

  // Other
  | "webhook"
  | "vpn"
  | "generic";

// ===== Credentials =====

export const CREDENTIAL_ENVIRONMENTS = ["production", "staging", "development"] as const;

export type CredentialEnvironment = (typeof CREDENTIAL_ENVIRONMENTS)[number];

export interface Credential {
  id: string;
  projectId?: string;
  name: string;
  type: ServiceType;
  description?: string;
  fields: Record<string, string>;
  linkedServers?: string[];
  environment?: CredentialEnvironment | null;
  /** Desired rotation interval in days; null when rotation is not tracked. */
  rotationDays?: number | null;
  /** Set on creation and whenever a secret field value changes. */
  lastRotatedAt?: string | null;
  /** Empty string when the creator has been deleted. */
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
}

// ===== Services =====

export interface Service {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  url?: string;
  tags?: string[];
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
}

// ===== Projects =====

export interface Project {
  id: string;
  name: string;
  description: string;
  organizationId?: string;
  ownerId: string;
  visibility?: "private" | "organization";
  credentials: Credential[];
  createdAt: string;
  updatedAt: string;
}

// ===== UI Support Types =====

export interface ServiceFieldDefinition {
  name: string;
  label: string;
  type: "text" | "password" | "number" | "url" | "email" | "textarea";
  required: boolean;
  placeholder?: string;
  description?: string;
}

export interface ServiceMetadata {
  type: ServiceType;
  category: string;
  label: string;
  icon: string;
  color: string;
  fields: ServiceFieldDefinition[];
}

// ===== Auth Context =====

/** One of the user's organization memberships. */
export interface UserOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole | string;
}

export interface AuthContext {
  user: User;
  sessionId: string;
  /** Active organization: the "active_org" cookie when valid, else a team org the user joined, else their own. */
  organization?: Organization;
  organizationRole?: OrganizationRole | string;
  /** Every organization the user belongs to. */
  organizations: UserOrganizationSummary[];
  permissions: string[];
}

export interface PermissionContext {
  userId: string;
  organizationId?: string;
  role: UserRole | OrganizationRole | string;
  resourceOwnerId?: string;
}

// ===== API Response Types =====

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ===== Dashboard Stats =====

export interface DashboardStats {
  totalMembers: number;
  activeProjects: number;
  totalCredentials: number;
  recentActivity: AuditLog[];
  memberActivity: {
    userId: string;
    username: string;
    actionCount: number;
    lastActivity: string;
  }[];
}

// ===== Admin statistics =====

export const STATS_RANGES = ["24h", "7d", "30d"] as const;

export type StatsRange = (typeof STATS_RANGES)[number];

export interface SecurityAlert {
  /** brute_force: >= 5 failed sign-ins for one username or IP within 10 minutes. mass_reveal: >= 10 credential reveals by one user within 1 hour. */
  type: "brute_force" | "mass_reveal";
  severity: "high" | "medium";
  /** Username, IP address or user display name the alert is about. */
  subject: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  message: string;
}

export interface AdminStats {
  range: StatsRange;
  scope: "platform" | "organization";
  since: string;
  generatedAt: string;
  users: { total: number; activeInRange: number };
  projects: { total: number; personal: number; organization: number };
  credentials: { total: number; newInRange: number };
  events: { total: number };
  failedSignIns: { total: number; distinctIps: number };
  /** Hourly buckets for 24h, daily buckets otherwise; `bucket` is the UTC start of the bucket. */
  activity: { granularity: "hour" | "day"; series: { bucket: string; count: number }[] };
  actionBreakdown: { action: string; count: number }[];
  topContributors: { userId: string; name: string; username: string; events: number }[];
  securityAlerts: SecurityAlert[];
  system: {
    dbSizeBytes: number;
    encryptionKeySource: "env" | "file";
    activeSessions: number;
    version: string;
  };
}

// ===== Import/Export =====

export interface ExportData {
  type: "full" | "partial";
  version: string;
  exportedAt: string;
  projects: Project[];
}

// Legacy support - old user profile type
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  role?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}
