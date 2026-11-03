import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type {
  AdminStats,
  AuditLog,
  Credential,
  CredentialEnvironment,
  Invitation,
  Organization,
  OrganizationMember,
  Project,
  SecurityAlert,
  Service,
  ServiceType,
  Session,
  StatsRange,
  User,
} from "./types";
import { CREDENTIAL_ENVIRONMENTS } from "./types";
import { CREDENTIAL_CONFIG } from "./config/constants";
import { isSecretField } from "./utils/credentials";
import { ValidationError } from "./utils/errors";
import {
  decryptString,
  encryptString,
  ensureDataDir,
  generateToken,
  getEncryptionKeyInfo,
  sha256Hex,
} from "./crypto-server";

const DB_FILE_NAME = "credzo.db";

/** Bump when adding a one-off data migration to runMigrations(). */
const SCHEMA_VERSION = 1;

let db: Database.Database | null = null;

export function getDatabasePath(): string {
  return path.join(ensureDataDir(), DB_FILE_NAME);
}

export function getDb(): Database.Database {
  if (!db) {
    const database = new Database(getDatabasePath());
    database.pragma("journal_mode = WAL");
    database.pragma("busy_timeout = 5000");
    database.pragma("synchronous = NORMAL");
    database.pragma("foreign_keys = ON");
    // Overwrite deleted content so removed secrets do not linger in free pages.
    database.pragma("secure_delete = ON");
    initializeDatabase(database);
    db = database;
  }
  return db;
}

/** Size of the database including its write-ahead log, in bytes. */
export function getDatabaseSize(): number {
  const dbPath = getDatabasePath();
  return [dbPath, `${dbPath}-wal`].reduce((total, file) => {
    try {
      return total + fs.statSync(file).size;
    } catch {
      return total;
    }
  }, 0);
}

// ===== Schema =====

const USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    is_verified INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login TEXT
  )
`;

const ORGANIZATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    owner_id TEXT NOT NULL,
    settings TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const ORGANIZATION_MEMBERS_TABLE = `
  CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    invited_by TEXT,
    invited_at TEXT,
    joined_at TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, user_id)
  )
`;

const PROJECTS_TABLE = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    organization_id TEXT,
    owner_id TEXT NOT NULL,
    visibility TEXT DEFAULT 'private',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const PROJECT_MEMBERS_TABLE = `
  CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    added_by TEXT,
    added_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(project_id, user_id)
  )
`;

const SERVICES_TABLE = `
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    url TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`;

// created_by is nullable so deleting a user keeps the credentials they created.
const CREDENTIALS_TABLE = `
  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    fields TEXT NOT NULL,
    linked_servers TEXT,
    environment TEXT,
    rotation_days INTEGER,
    last_rotated_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
  )
`;

// user_id is nullable: failed sign-ins for unknown accounts have no actor, and
// deleting a user keeps their audit trail.
const AUDIT_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`;

const SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_activity TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const LOGIN_CHALLENGES_TABLE = `
  CREATE TABLE IF NOT EXISTS login_challenges (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    persistent INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const INVITATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    invited_by TEXT,
    token TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    responded_at TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
  )
`;

const INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

  CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
  CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

  CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
  CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

  CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
  CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
  CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);

  CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
  CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);

  CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);

  CREATE INDEX IF NOT EXISTS idx_credentials_project ON credentials(project_id);
  CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(type);
  CREATE INDEX IF NOT EXISTS idx_credentials_created_by ON credentials(created_by);

  CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
  CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

  CREATE INDEX IF NOT EXISTS idx_login_challenges_expires ON login_challenges(expires_at);

  CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(organization_id);
  CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
  CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
  CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
`;

function initializeDatabase(database: Database.Database) {
  for (const table of [
    USERS_TABLE,
    ORGANIZATIONS_TABLE,
    ORGANIZATION_MEMBERS_TABLE,
    PROJECTS_TABLE,
    PROJECT_MEMBERS_TABLE,
    SERVICES_TABLE,
    CREDENTIALS_TABLE,
    AUDIT_LOGS_TABLE,
    SESSIONS_TABLE,
    LOGIN_CHALLENGES_TABLE,
    INVITATIONS_TABLE,
  ]) {
    database.exec(table);
  }

  // Columns added after the first release (idempotent).
  ensureColumn(database, "users", "totp_secret", "TEXT");
  ensureColumn(database, "users", "totp_enabled", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "users", "totp_last_step", "INTEGER");
  ensureColumn(database, "users", "backup_codes", "TEXT");
  ensureColumn(database, "users", "password_changed_at", "TEXT");
  ensureColumn(database, "users", "job_title", "TEXT");
  ensureColumn(database, "users", "timezone", "TEXT");
  ensureColumn(database, "credentials", "environment", "TEXT");
  ensureColumn(database, "credentials", "rotation_days", "INTEGER");
  ensureColumn(database, "credentials", "last_rotated_at", "TEXT");
  ensureColumn(database, "sessions", "persistent", "INTEGER NOT NULL DEFAULT 0");

  // Legacy tables declared NOT NULL on columns whose foreign key is ON DELETE SET NULL,
  // which made deleting users fail. Rebuild them with nullable columns.
  if (isColumnNotNull(database, "audit_logs", "user_id")) {
    rebuildTable(database, "audit_logs", AUDIT_LOGS_TABLE);
  }
  if (isColumnNotNull(database, "credentials", "created_by")) {
    rebuildTable(database, "credentials", CREDENTIALS_TABLE);
  }
  if (isColumnNotNull(database, "invitations", "invited_by")) {
    rebuildTable(database, "invitations", INVITATIONS_TABLE);
  }

  database.exec(INDEXES);

  runMigrations(database);
  migrateLegacyUserProfile(database);
  encryptPlaintextSecrets(database);
}

function getColumns(database: Database.Database, table: string): { name: string; notnull: number }[] {
  return database.prepare(`PRAGMA table_info(${table})`).all() as { name: string; notnull: number }[];
}

function ensureColumn(database: Database.Database, table: string, column: string, definition: string) {
  if (!getColumns(database, table).some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function isColumnNotNull(database: Database.Database, table: string, column: string): boolean {
  return getColumns(database, table).some((c) => c.name === column && c.notnull === 1);
}

/**
 * Recreates a table from its current CREATE statement, copying every column the
 * old and new definitions share (https://www.sqlite.org/lang_altertable.html#otheralter).
 */
function rebuildTable(database: Database.Database, table: string, createSql: string) {
  const tempTable = `${table}__rebuild`;
  const oldColumns = new Set(getColumns(database, table).map((c) => c.name));

  database.pragma("foreign_keys = OFF");
  try {
    database.transaction(() => {
      database.exec(`DROP TABLE IF EXISTS ${tempTable}`);
      database.exec(createSql.replace(`CREATE TABLE IF NOT EXISTS ${table}`, `CREATE TABLE ${tempTable}`));
      const shared = getColumns(database, tempTable)
        .map((c) => c.name)
        .filter((name) => oldColumns.has(name))
        .join(", ");
      database.exec(`INSERT INTO ${tempTable} (${shared}) SELECT ${shared} FROM ${table}`);
      database.exec(`DROP TABLE ${table}`);
      database.exec(`ALTER TABLE ${tempTable} RENAME TO ${table}`);
      const violations = database.pragma("foreign_key_check") as unknown[];
      if (violations.length > 0) {
        throw new Error(`Foreign key check failed while rebuilding ${table}`);
      }
    })();
  } finally {
    database.pragma("foreign_keys = ON");
  }
}

function runMigrations(database: Database.Database) {
  const version = database.pragma("user_version", { simple: true }) as number;
  if (version >= SCHEMA_VERSION) return;

  database.transaction(() => {
    if (version < 1) {
      // Sessions used to store raw tokens; they now store SHA-256 hashes.
      database.exec("DELETE FROM sessions");
    }
    database.pragma(`user_version = ${SCHEMA_VERSION}`);
  })();
}

/** Moves a pre-multi-user `user_profile` row into `users` (one-time, legacy installs). */
function migrateLegacyUserProfile(database: Database.Database) {
  const hasOldUserTable = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_profile'")
    .get();
  if (!hasOldUserTable) return;

  const oldUser = database.prepare("SELECT * FROM user_profile LIMIT 1").get() as
    | {
        username: string;
        email: string;
        password_hash: string | null;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
        created_at: string | null;
        updated_at: string | null;
      }
    | undefined;
  if (!oldUser) return;

  const existingUser = database.prepare("SELECT id FROM users WHERE username = ?").get(oldUser.username);
  if (existingUser) return;

  const userId = generateId("user");
  const orgId = generateId("org");
  const now = new Date().toISOString();

  database.transaction(() => {
    database
      .prepare(
        `INSERT INTO users (
          id, username, email, password_hash, first_name, last_name,
          role, avatar_url, is_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        oldUser.username,
        oldUser.email,
        oldUser.password_hash || "",
        oldUser.first_name,
        oldUser.last_name,
        "platform_admin",
        oldUser.avatar_url,
        1,
        oldUser.created_at || now,
        oldUser.updated_at || now
      );

    database
      .prepare(
        `INSERT INTO organizations (
          id, name, slug, description, owner_id, settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        orgId,
        `${oldUser.username}'s Organization`,
        oldUser.username.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        "Default organization",
        userId,
        "{}",
        now,
        now
      );

    database
      .prepare(
        `INSERT INTO organization_members (
          id, organization_id, user_id, role, joined_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(generateId("mem"), orgId, userId, "owner", now, now);

    database
      .prepare("UPDATE projects SET organization_id = ?, owner_id = ?, updated_at = ?")
      .run(orgId, userId, now);
    database.prepare("UPDATE credentials SET created_by = ?, updated_at = ?").run(userId, now);
  })();
}

/**
 * Encrypts any credential fields / TOTP secrets still stored as plaintext and
 * verifies that the configured key can decrypt existing data. Idempotent.
 */
function encryptPlaintextSecrets(database: Database.Database) {
  getEncryptionKeyInfo();

  const sample = database
    .prepare("SELECT fields FROM credentials WHERE fields LIKE 'enc:v1:%' LIMIT 1")
    .get() as { fields: string } | undefined;
  if (sample) decryptString(sample.fields);

  const plaintextCredentials = database
    .prepare("SELECT id, fields FROM credentials WHERE fields NOT LIKE 'enc:v1:%'")
    .all() as { id: string; fields: string }[];
  const plaintextSecrets = database
    .prepare("SELECT id, totp_secret FROM users WHERE totp_secret IS NOT NULL AND totp_secret NOT LIKE 'enc:v1:%'")
    .all() as { id: string; totp_secret: string }[];

  if (plaintextCredentials.length === 0 && plaintextSecrets.length === 0) return;

  const updateFields = database.prepare("UPDATE credentials SET fields = ? WHERE id = ?");
  const updateSecret = database.prepare("UPDATE users SET totp_secret = ? WHERE id = ?");

  database.transaction(() => {
    for (const row of plaintextCredentials) updateFields.run(encryptString(row.fields), row.id);
    for (const row of plaintextSecrets) updateSecret.run(encryptString(row.totp_secret), row.id);
  })();

  console.info(
    `[credzo] Encrypted ${plaintextCredentials.length} credential(s) and ${plaintextSecrets.length} TOTP secret(s) at rest`
  );
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

// ===== Row shapes =====

type SqlValue = string | number | null;

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar_url: string | null;
  is_verified: number;
  totp_enabled: number;
  backup_codes: string | null;
  job_title: string | null;
  timezone: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  settings: string | null;
  created_at: string;
  updated_at: string;
}

interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string;
  updated_at: string;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  owner_id: string;
  visibility: "private" | "organization" | null;
  created_at: string;
  updated_at: string;
}

interface CredentialRow {
  id: string;
  project_id: string;
  name: string;
  type: ServiceType;
  description: string | null;
  fields: string;
  linked_servers: string | null;
  environment: CredentialEnvironment | null;
  rotation_days: number | null;
  last_rotated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

interface ServiceRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  url: string | null;
  tags: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

interface AuditLogRow {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  token: string;
  persistent: number;
  expires_at: string;
  created_at: string;
  last_activity: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface InvitationRow {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  invited_by: string | null;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
  responded_at: string | null;
}

// ===== User Management =====

/** `passwordHash` must already be hashed (see hashPassword in lib/auth.ts). */
export function createUser(data: {
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role?: string;
}): User {
  const database = getDb();
  const now = new Date().toISOString();
  const id = generateId("user");

  database
    .prepare(
      `INSERT INTO users (
        id, username, email, password_hash, first_name, last_name,
        role, is_verified, password_changed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      data.username,
      data.email,
      data.passwordHash,
      data.firstName,
      data.lastName,
      data.role || "user",
      0,
      now,
      now,
      now
    );

  return getUserById(id)!;
}

export function getUserById(id: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? mapUserFromDb(row) : null;
}

/** Case-insensitive lookup. */
export function getUserByUsername(username: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as
    | UserRow
    | undefined;
  return row ? mapUserFromDb(row) : null;
}

/** Case-insensitive lookup. */
export function getUserByEmail(email: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as
    | UserRow
    | undefined;
  return row ? mapUserFromDb(row) : null;
}

export function getAllUsers(): User[] {
  const rows = getDb().prepare("SELECT * FROM users ORDER BY created_at DESC").all() as UserRow[];
  return rows.map(mapUserFromDb);
}

const USER_UPDATE_COLUMNS: [keyof User, string][] = [
  ["username", "username"],
  ["email", "email"],
  ["firstName", "first_name"],
  ["lastName", "last_name"],
  ["role", "role"],
  ["avatarUrl", "avatar_url"],
  ["jobTitle", "job_title"],
  ["timezone", "timezone"],
];

/** Optional profile columns store "" as NULL. */
const NULLABLE_USER_FIELDS = new Set<keyof User>(["avatarUrl", "jobTitle", "timezone"]);

export function updateUser(id: string, updates: Partial<User>): User | null {
  const fields: string[] = [];
  const values: SqlValue[] = [];

  for (const [key, column] of USER_UPDATE_COLUMNS) {
    const value = updates[key];
    if (typeof value === "string") {
      fields.push(`${column} = ?`);
      values.push(value === "" && NULLABLE_USER_FIELDS.has(key) ? null : value);
    }
  }

  fields.push("updated_at = ?");
  values.push(new Date().toISOString(), id);

  getDb().prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getUserById(id);
}

/** `newPasswordHash` must already be hashed (see hashPassword in lib/auth.ts). */
export function updateUserPassword(userId: string, newPasswordHash: string): boolean {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare("UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?")
    .run(newPasswordHash, now, now, userId);
  return result.changes > 0;
}

/** Replaces a hash without touching password_changed_at (transparent algorithm upgrades). */
export function replaceUserPasswordHash(userId: string, passwordHash: string): void {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

export function updateUserLastLogin(userId: string): void {
  getDb().prepare("UPDATE users SET last_login = ? WHERE id = ?").run(new Date().toISOString(), userId);
}

export function deleteUser(id: string): boolean {
  const result = getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
  return result.changes > 0;
}

function parseBackupCodes(value: string | null): string[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === "string") : [];
}

function mapUserFromDb(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    avatarUrl: row.avatar_url ?? undefined,
    isVerified: row.is_verified === 1,
    totpEnabled: row.totp_enabled === 1,
    backupCodesRemaining: row.totp_enabled === 1 ? parseBackupCodes(row.backup_codes).length : 0,
    jobTitle: row.job_title ?? undefined,
    timezone: row.timezone ?? undefined,
    passwordChangedAt: row.password_changed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLogin: row.last_login ?? undefined,
  };
}

// ===== Two-factor authentication =====

export interface UserTwoFactorState {
  /** Decrypted base32 secret; present while setup is pending or once enabled. */
  secret: string | null;
  enabled: boolean;
  lastUsedStep: number | null;
  backupCodeHashes: string[];
}

export function getUserTwoFactorState(userId: string): UserTwoFactorState | null {
  const row = getDb()
    .prepare("SELECT totp_secret, totp_enabled, totp_last_step, backup_codes FROM users WHERE id = ?")
    .get(userId) as
    | { totp_secret: string | null; totp_enabled: number; totp_last_step: number | null; backup_codes: string | null }
    | undefined;
  if (!row) return null;

  return {
    secret: row.totp_secret ? decryptString(row.totp_secret) : null,
    enabled: row.totp_enabled === 1,
    lastUsedStep: row.totp_last_step,
    backupCodeHashes: parseBackupCodes(row.backup_codes),
  };
}

/** Stores a not-yet-verified secret; 2FA stays disabled until enableUserTwoFactor. */
export function setPendingTwoFactorSecret(userId: string, secret: string): void {
  getDb()
    .prepare("UPDATE users SET totp_secret = ?, totp_enabled = 0, totp_last_step = NULL, backup_codes = NULL WHERE id = ?")
    .run(encryptString(secret), userId);
}

export function enableUserTwoFactor(userId: string, verifiedStep: number, backupCodeHashes: string[]): void {
  getDb()
    .prepare("UPDATE users SET totp_enabled = 1, totp_last_step = ?, backup_codes = ?, updated_at = ? WHERE id = ?")
    .run(verifiedStep, JSON.stringify(backupCodeHashes), new Date().toISOString(), userId);
}

export function disableUserTwoFactor(userId: string): void {
  getDb()
    .prepare(
      "UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_last_step = NULL, backup_codes = NULL, updated_at = ? WHERE id = ?"
    )
    .run(new Date().toISOString(), userId);
}

/** Records the last accepted TOTP step so the same code cannot be replayed. */
export function setTotpLastUsedStep(userId: string, step: number): void {
  getDb().prepare("UPDATE users SET totp_last_step = ? WHERE id = ?").run(step, userId);
}

/** Atomically removes a backup code hash; returns false when it was not present. */
export function consumeBackupCode(userId: string, codeHash: string): boolean {
  const database = getDb();
  return database.transaction(() => {
    const row = database.prepare("SELECT backup_codes FROM users WHERE id = ?").get(userId) as
      | { backup_codes: string | null }
      | undefined;
    const hashes = parseBackupCodes(row?.backup_codes ?? null);
    const index = hashes.indexOf(codeHash);
    if (index === -1) return false;
    hashes.splice(index, 1);
    database.prepare("UPDATE users SET backup_codes = ? WHERE id = ?").run(JSON.stringify(hashes), userId);
    return true;
  })();
}

// ===== Organization Management =====

export function createOrganization(data: {
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
}): Organization {
  const now = new Date().toISOString();
  const id = generateId("org");

  getDb()
    .prepare(
      `INSERT INTO organizations (
        id, name, slug, description, owner_id, settings, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, data.name, data.slug, data.description || "", data.ownerId, "{}", now, now);

  addOrganizationMember({ organizationId: id, userId: data.ownerId, role: "owner" });

  return getOrganizationById(id)!;
}

export function getOrganizationById(id: string): Organization | null {
  const row = getDb().prepare("SELECT * FROM organizations WHERE id = ?").get(id) as OrganizationRow | undefined;
  return row ? mapOrganizationFromDb(row) : null;
}

export function getOrganizationBySlug(slug: string): Organization | null {
  const row = getDb().prepare("SELECT * FROM organizations WHERE slug = ?").get(slug) as OrganizationRow | undefined;
  return row ? mapOrganizationFromDb(row) : null;
}

export function getOrganizationsByOwner(ownerId: string): Organization[] {
  const rows = getDb()
    .prepare("SELECT * FROM organizations WHERE owner_id = ? ORDER BY created_at DESC")
    .all(ownerId) as OrganizationRow[];
  return rows.map(mapOrganizationFromDb);
}

export function getUserOrganizations(userId: string): Organization[] {
  const rows = getDb()
    .prepare(
      `SELECT o.* FROM organizations o
       INNER JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = ?
       ORDER BY o.created_at DESC`
    )
    .all(userId) as OrganizationRow[];
  return rows.map(mapOrganizationFromDb);
}

export interface OrganizationMembership {
  organization: Organization;
  role: string;
  joinedAt: string;
}

/** The user's memberships, most recently joined first. */
export function getUserOrganizationMemberships(userId: string): OrganizationMembership[] {
  const rows = getDb()
    .prepare(
      `SELECT o.*, om.role AS member_role, om.joined_at AS member_joined_at
       FROM organizations o
       INNER JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = ?
       ORDER BY om.joined_at DESC, o.created_at DESC`
    )
    .all(userId) as (OrganizationRow & { member_role: string; member_joined_at: string | null })[];

  return rows.map((row) => ({
    organization: mapOrganizationFromDb(row),
    role: row.member_role,
    joinedAt: row.member_joined_at ?? row.created_at,
  }));
}

export function updateOrganization(id: string, updates: Partial<Organization>): Organization | null {
  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.slug !== undefined) {
    fields.push("slug = ?");
    values.push(updates.slug);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.settings !== undefined) {
    fields.push("settings = ?");
    values.push(JSON.stringify(updates.settings));
  }

  fields.push("updated_at = ?");
  values.push(new Date().toISOString(), id);

  getDb().prepare(`UPDATE organizations SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getOrganizationById(id);
}

export function deleteOrganization(id: string): boolean {
  const result = getDb().prepare("DELETE FROM organizations WHERE id = ?").run(id);
  return result.changes > 0;
}

function mapOrganizationFromDb(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    ownerId: row.owner_id,
    settings: row.settings ? JSON.parse(row.settings) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ===== Organization Members Management =====

export function addOrganizationMember(data: {
  organizationId: string;
  userId: string;
  role: string;
  invitedBy?: string;
}): OrganizationMember {
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO organization_members (
        id, organization_id, user_id, role, invited_by, joined_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(generateId("mem"), data.organizationId, data.userId, data.role, data.invitedBy || null, now, now);

  return getOrganizationMember(data.organizationId, data.userId)!;
}

export function getOrganizationMember(organizationId: string, userId: string): OrganizationMember | null {
  const row = getDb()
    .prepare("SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?")
    .get(organizationId, userId) as OrganizationMemberRow | undefined;
  return row ? mapOrganizationMemberFromDb(row) : null;
}

export function getOrganizationMembers(organizationId: string): OrganizationMember[] {
  const rows = getDb()
    .prepare("SELECT * FROM organization_members WHERE organization_id = ? ORDER BY joined_at DESC")
    .all(organizationId) as OrganizationMemberRow[];
  return rows.map(mapOrganizationMemberFromDb);
}

export function updateOrganizationMemberRole(
  organizationId: string,
  userId: string,
  role: string
): OrganizationMember | null {
  getDb()
    .prepare("UPDATE organization_members SET role = ?, updated_at = ? WHERE organization_id = ? AND user_id = ?")
    .run(role, new Date().toISOString(), organizationId, userId);
  return getOrganizationMember(organizationId, userId);
}

export function removeOrganizationMember(organizationId: string, userId: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?")
    .run(organizationId, userId);
  return result.changes > 0;
}

function mapOrganizationMemberFromDb(row: OrganizationMemberRow): OrganizationMember {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    invitedBy: row.invited_by ?? undefined,
    invitedAt: row.invited_at ?? undefined,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  };
}

// ===== Projects =====

/**
 * A project is "personal" when it has no organization, or when it lives in a
 * workspace owned by the project owner that has no other members. Expects the
 * projects table aliased as `p`.
 */
const PERSONAL_PROJECT_SQL = `(
  p.organization_id IS NULL OR (
    (SELECT o.owner_id FROM organizations o WHERE o.id = p.organization_id) = p.owner_id
    AND (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = p.organization_id) <= 1
  )
)`;

function mapProjectFromDb(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    organizationId: row.organization_id ?? undefined,
    ownerId: row.owner_id,
    visibility: row.visibility ?? undefined,
    credentials: getProjectCredentials(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllProjects(filters?: {
  userId?: string;
  organizationId?: string;
  scope?: "personal" | "organization" | "all";
}): Project[] {
  let query = "SELECT * FROM projects WHERE 1=1";
  const params: SqlValue[] = [];

  if (filters?.organizationId) {
    query += " AND organization_id = ?";
    params.push(filters.organizationId);
  } else if (filters?.scope === "personal") {
    query += " AND organization_id IS NULL";
  } else if (filters?.scope === "organization") {
    query += " AND organization_id IS NOT NULL";
  }

  if (filters?.userId) {
    query += " AND owner_id = ?";
    params.push(filters.userId);
  }

  query += " ORDER BY updated_at DESC";

  const rows = getDb().prepare(query).all(...params) as ProjectRow[];
  return rows.map(mapProjectFromDb);
}

export function getProjectById(id: string): Project | null {
  const row = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  return row ? mapProjectFromDb(row) : null;
}

export function createProject(
  name: string,
  description: string = "",
  ownerId: string,
  organizationId?: string
): Project {
  const now = new Date().toISOString();
  const id = generateId("proj");

  getDb()
    .prepare(
      `INSERT INTO projects (
        id, name, description, organization_id, owner_id, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, name, description, organizationId || null, ownerId, organizationId ? "organization" : "private", now, now);

  return getProjectById(id)!;
}

export function updateProject(id: string, updates: Partial<Project>): Project | null {
  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.visibility !== undefined) {
    fields.push("visibility = ?");
    values.push(updates.visibility);
  }

  fields.push("updated_at = ?");
  values.push(new Date().toISOString(), id);

  getDb().prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getProjectById(id);
}

export function deleteProject(id: string): boolean {
  const database = getDb();
  return database.transaction(() => {
    database.prepare("DELETE FROM credentials WHERE project_id = ?").run(id);
    return database.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
  })();
}

// ===== Credentials =====
// `fields` is stored encrypted (AES-256-GCM, see lib/crypto-server.ts) and is
// only ever decrypted here, on read.

function mapCredentialFromDb(row: CredentialRow): Credential {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type,
    description: row.description || "",
    fields: JSON.parse(decryptString(row.fields)),
    linkedServers: row.linked_servers ? JSON.parse(row.linked_servers) : [],
    environment: row.environment,
    rotationDays: row.rotation_days,
    lastRotatedAt: row.last_rotated_at,
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  };
}

function normalizeEnvironment(value: unknown): CredentialEnvironment | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string" && (CREDENTIAL_ENVIRONMENTS as readonly string[]).includes(value)) {
    return value as CredentialEnvironment;
  }
  throw new ValidationError(`Environment must be one of: ${CREDENTIAL_ENVIRONMENTS.join(", ")}`);
}

function normalizeRotationDays(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const { ROTATION_DAYS_MIN: min, ROTATION_DAYS_MAX: max } = CREDENTIAL_CONFIG;
  if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) return value;
  throw new ValidationError(`Rotation interval must be a whole number of days between ${min} and ${max}`);
}

function serializeLinkedServers(linkedServers: string[] | undefined): string | null {
  return linkedServers && linkedServers.length > 0 ? JSON.stringify(linkedServers) : null;
}

/** True when any secret field (see isSecretField) was added, removed or changed. */
function secretsChanged(type: ServiceType, before: Record<string, string>, after: Record<string, string>): boolean {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].some(
    (name) => isSecretField(type, name) && String(before[name] ?? "") !== String(after[name] ?? "")
  );
}

export function getProjectCredentials(projectId: string): Credential[] {
  const rows = getDb()
    .prepare("SELECT * FROM credentials WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as CredentialRow[];
  return rows.map(mapCredentialFromDb);
}

export function getCredentialById(id: string): Credential | null {
  const row = getDb().prepare("SELECT * FROM credentials WHERE id = ?").get(id) as CredentialRow | undefined;
  return row ? mapCredentialFromDb(row) : null;
}

/** Throws ValidationError for an unknown environment or an out-of-range rotation interval. */
export function createCredential(
  projectId: string,
  data: Omit<Credential, "id" | "createdAt" | "updatedAt">,
  createdBy: string
): Credential | null {
  if (!getProjectById(projectId)) return null;

  const database = getDb();
  const now = new Date().toISOString();
  const id = generateId("cred");
  const environment = normalizeEnvironment(data.environment);
  const rotationDays = normalizeRotationDays(data.rotationDays);

  database.transaction(() => {
    database
      .prepare(
        `INSERT INTO credentials (
          id, project_id, name, type, description, fields, linked_servers,
          environment, rotation_days, last_rotated_at, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        projectId,
        data.name,
        data.type,
        data.description || "",
        encryptString(JSON.stringify(data.fields ?? {})),
        serializeLinkedServers(data.linkedServers),
        environment,
        rotationDays,
        now,
        createdBy,
        now,
        now
      );
    database.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, projectId);
  })();

  return getCredentialById(id);
}

/**
 * Applies a partial update. `lastRotatedAt` is bumped whenever a secret field
 * value changes, or set from `updates.lastRotatedAt` (a rotation done outside
 * Credzo). Throws ValidationError like createCredential.
 */
export function updateCredential(id: string, updates: Partial<Credential>, updatedBy: string): Credential | null {
  const existing = getCredentialById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.type !== undefined) {
    fields.push("type = ?");
    values.push(updates.type);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.fields !== undefined) {
    fields.push("fields = ?");
    values.push(encryptString(JSON.stringify(updates.fields)));
    if (secretsChanged(updates.type ?? existing.type, existing.fields, updates.fields)) {
      fields.push("last_rotated_at = ?");
      values.push(now);
    }
  }
  if (updates.linkedServers !== undefined) {
    fields.push("linked_servers = ?");
    values.push(serializeLinkedServers(updates.linkedServers));
  }
  if (updates.environment !== undefined) {
    fields.push("environment = ?");
    values.push(normalizeEnvironment(updates.environment));
  }
  if (updates.rotationDays !== undefined) {
    fields.push("rotation_days = ?");
    values.push(normalizeRotationDays(updates.rotationDays));
  }
  if (updates.lastRotatedAt !== undefined && !fields.includes("last_rotated_at = ?")) {
    fields.push("last_rotated_at = ?");
    values.push(updates.lastRotatedAt);
  }

  fields.push("updated_by = ?", "updated_at = ?");
  values.push(updatedBy, now, id);

  getDb().prepare(`UPDATE credentials SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getCredentialById(id);
}

export function deleteCredential(id: string): boolean {
  const result = getDb().prepare("DELETE FROM credentials WHERE id = ?").run(id);
  return result.changes > 0;
}

// ===== Services =====

function mapServiceFromDb(row: ServiceRow): Service {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description || "",
    url: row.url || "",
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  };
}

export function getProjectServices(projectId: string): Service[] {
  const rows = getDb()
    .prepare("SELECT * FROM services WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as ServiceRow[];
  return rows.map(mapServiceFromDb);
}

export function getServiceById(id: string): Service | null {
  const row = getDb().prepare("SELECT * FROM services WHERE id = ?").get(id) as ServiceRow | undefined;
  return row ? mapServiceFromDb(row) : null;
}

export function createService(
  projectId: string,
  data: { name: string; description?: string; url?: string; tags?: string[] },
  createdBy: string
): Service | null {
  const now = new Date().toISOString();
  const id = generateId("service");

  getDb()
    .prepare(
      `INSERT INTO services (
        id, project_id, name, description, url, tags, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, projectId, data.name, data.description || "", data.url || "", JSON.stringify(data.tags || []), createdBy, now, now);

  return getServiceById(id);
}

export function updateService(
  id: string,
  updates: { name?: string; description?: string; url?: string; tags?: string[] },
  updatedBy: string
): Service | null {
  const setParts: string[] = [];
  const params: SqlValue[] = [];

  if (updates.name !== undefined) {
    setParts.push("name = ?");
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    setParts.push("description = ?");
    params.push(updates.description);
  }
  if (updates.url !== undefined) {
    setParts.push("url = ?");
    params.push(updates.url);
  }
  if (updates.tags !== undefined) {
    setParts.push("tags = ?");
    params.push(JSON.stringify(updates.tags));
  }

  if (setParts.length === 0) return getServiceById(id);

  setParts.push("updated_by = ?", "updated_at = ?");
  params.push(updatedBy, new Date().toISOString(), id);

  getDb().prepare(`UPDATE services SET ${setParts.join(", ")} WHERE id = ?`).run(...params);
  return getServiceById(id);
}

export function deleteService(id: string): boolean {
  const result = getDb().prepare("DELETE FROM services WHERE id = ?").run(id);
  return result.changes > 0;
}

// ===== Audit Logs =====

export function createAuditLog(data: {
  organizationId?: string | null;
  /** null for events without a known actor (e.g. a failed sign-in for an unknown username). */
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO audit_logs (
        id, organization_id, user_id, action, resource_type, resource_id,
        details, ip_address, user_agent, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      generateId("audit"),
      data.organizationId || null,
      data.userId || null,
      data.action,
      data.resourceType,
      data.resourceId || null,
      data.details ? JSON.stringify(data.details) : null,
      data.ipAddress || null,
      data.userAgent || null,
      new Date().toISOString()
    );
}

export interface AuditLogFilters {
  organizationId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  /** ISO timestamp; only events at or after it. */
  since?: string;
  /** ISO timestamp; only events at or before it. */
  until?: string;
  /**
   * Case-insensitive substring over action, resource type and id, details, IP
   * address and the actor's username / name.
   */
  search?: string;
}

/** `%term%` with LIKE wildcards escaped by a backslash, so user input matches literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** FROM/WHERE clause over `audit_logs a` (joined with the actor in `u`) for the filters. */
function auditLogQuery(filters: AuditLogFilters = {}): { from: string; where: string; params: SqlValue[] } {
  const conditions: string[] = [];
  const params: SqlValue[] = [];
  const add = (condition: string, value: string | undefined) => {
    if (!value) return;
    conditions.push(condition);
    params.push(value);
  };

  add("a.organization_id = ?", filters.organizationId);
  add("a.user_id = ?", filters.userId);
  add("a.action = ?", filters.action);
  add("a.resource_type = ?", filters.resourceType);
  add("a.resource_id = ?", filters.resourceId);
  add("a.timestamp >= ?", filters.since);
  add("a.timestamp <= ?", filters.until);

  const search = filters.search;
  if (search) {
    const columns = [
      "a.action",
      "a.resource_type",
      "a.resource_id",
      "a.details",
      "a.ip_address",
      "u.username",
      "u.first_name || ' ' || u.last_name",
    ];
    conditions.push(`(${columns.map((column) => `${column} LIKE ? ESCAPE '\\'`).join(" OR ")})`);
    params.push(...columns.map(() => likePattern(search)));
  }

  return {
    from: search ? "audit_logs a LEFT JOIN users u ON u.id = a.user_id" : "audit_logs a",
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export function getAuditLogs(filters?: AuditLogFilters & { limit?: number; offset?: number }): AuditLog[] {
  const { from, where, params } = auditLogQuery(filters);
  let query = `SELECT a.* FROM ${from} ${where} ORDER BY a.timestamp DESC`;

  if (filters?.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
    if (filters.offset) {
      query += " OFFSET ?";
      params.push(filters.offset);
    }
  }

  const rows = getDb().prepare(query).all(...params) as AuditLogRow[];

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    userId: row.user_id ?? "",
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? undefined,
    details: row.details ? JSON.parse(row.details) : undefined,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    timestamp: row.timestamp,
  }));
}

/** Number of audit events matching the filters (for pagination totals). */
export function countAuditLogs(filters?: AuditLogFilters): number {
  const { from, where, params } = auditLogQuery(filters);
  const row = getDb().prepare(`SELECT COUNT(*) AS count FROM ${from} ${where}`).get(...params) as { count: number };
  return row.count;
}

// ===== Sessions =====
// The `token` column holds the SHA-256 of the session token; raw tokens only
// live in the client's cookie.

function mapSessionFromDb(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token,
    persistent: row.persistent === 1,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
  };
}

export function createSession(data: {
  userId: string;
  /** Raw token; only its hash is stored. */
  token: string;
  expiresAt: string;
  persistent: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Session {
  const now = new Date().toISOString();
  const id = generateId("sess");

  getDb()
    .prepare(
      `INSERT INTO sessions (
        id, user_id, token, persistent, expires_at, created_at, last_activity, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      data.userId,
      sha256Hex(data.token),
      data.persistent ? 1 : 0,
      data.expiresAt,
      now,
      now,
      data.ipAddress || null,
      data.userAgent || null
    );

  return getSessionByToken(data.token)!;
}

/** Looks up a session by its raw token (expired sessions included). */
export function getSessionByToken(token: string): Session | null {
  const row = getDb().prepare("SELECT * FROM sessions WHERE token = ?").get(sha256Hex(token)) as
    | SessionRow
    | undefined;
  return row ? mapSessionFromDb(row) : null;
}

/** Records activity and slides the expiry forward. */
export function touchSession(sessionId: string, expiresAt: string): void {
  getDb()
    .prepare("UPDATE sessions SET last_activity = ?, expires_at = ? WHERE id = ?")
    .run(new Date().toISOString(), expiresAt, sessionId);
}

/** Active (unexpired) sessions of a user, most recently used first. */
export function getUserSessions(userId: string): Session[] {
  const rows = getDb()
    .prepare("SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_activity DESC")
    .all(userId, new Date().toISOString()) as SessionRow[];
  return rows.map(mapSessionFromDb);
}

export function countActiveSessions(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?")
    .get(new Date().toISOString()) as { count: number };
  return row.count;
}

/** Deletes a session by its raw token. */
export function deleteSession(token: string): boolean {
  const result = getDb().prepare("DELETE FROM sessions WHERE token = ?").run(sha256Hex(token));
  return result.changes > 0;
}

export function deleteSessionById(sessionId: string): boolean {
  const result = getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  return result.changes > 0;
}

/** Deletes every session of the user except `exceptSessionId`; returns how many were removed. */
export function deleteUserSessions(userId: string, exceptSessionId?: string): number {
  const result = exceptSessionId
    ? getDb().prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").run(userId, exceptSessionId)
    : getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return result.changes;
}

/** Removes expired sessions and two-factor sign-in challenges. */
export function cleanupExpiredSessions(): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  database.prepare("DELETE FROM login_challenges WHERE expires_at < ?").run(now);
}

// ===== Two-factor sign-in challenges =====

export interface LoginChallenge {
  id: string;
  userId: string;
  /** Whether the session created after the challenge is a "keep me signed in" one. */
  persistent: boolean;
  attempts: number;
  expiresAt: string;
}

/** Creates a challenge (replacing the user's previous ones) and returns its raw token. */
export function createLoginChallenge(data: { userId: string; persistent: boolean; expiresAt: string }): string {
  const database = getDb();
  const token = generateToken();

  database.transaction(() => {
    database.prepare("DELETE FROM login_challenges WHERE user_id = ?").run(data.userId);
    database
      .prepare(
        `INSERT INTO login_challenges (id, token_hash, user_id, persistent, attempts, expires_at, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        generateId("chal"),
        sha256Hex(token),
        data.userId,
        data.persistent ? 1 : 0,
        data.expiresAt,
        new Date().toISOString()
      );
  })();

  return token;
}

/** Returns the unexpired challenge for a raw token, or null. */
export function getLoginChallenge(token: string): LoginChallenge | null {
  const row = getDb()
    .prepare("SELECT * FROM login_challenges WHERE token_hash = ? AND expires_at > ?")
    .get(sha256Hex(token), new Date().toISOString()) as
    | { id: string; user_id: string; persistent: number; attempts: number; expires_at: string }
    | undefined;
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    persistent: row.persistent === 1,
    attempts: row.attempts,
    expiresAt: row.expires_at,
  };
}

/** Counts a wrong code against the challenge; returns the new attempt count. */
export function recordLoginChallengeFailure(challengeId: string): number {
  const row = getDb()
    .prepare("UPDATE login_challenges SET attempts = attempts + 1 WHERE id = ? RETURNING attempts")
    .get(challengeId) as { attempts: number } | undefined;
  return row?.attempts ?? 0;
}

export function deleteLoginChallenge(challengeId: string): void {
  getDb().prepare("DELETE FROM login_challenges WHERE id = ?").run(challengeId);
}

// ===== Invitations =====

function mapInvitationFromDb(row: InvitationRow): Invitation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role,
    invitedBy: row.invited_by ?? undefined,
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? undefined,
  };
}

export function createInvitation(data: {
  organizationId: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
}): Invitation {
  const token = generateToken();

  getDb()
    .prepare(
      `INSERT INTO invitations (
        id, organization_id, email, role, invited_by, token, status, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      generateId("inv"),
      data.organizationId,
      data.email,
      data.role,
      data.invitedBy,
      token,
      "pending",
      data.expiresAt,
      new Date().toISOString()
    );

  return getInvitationByToken(token)!;
}

export function getInvitationByToken(token: string): Invitation | null {
  const row = getDb().prepare("SELECT * FROM invitations WHERE token = ?").get(token) as InvitationRow | undefined;
  return row ? mapInvitationFromDb(row) : null;
}

/** Pending invitations of an organization that have not expired, newest first. */
export function getPendingInvitations(organizationId: string): Invitation[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM invitations
       WHERE organization_id = ? AND status = 'pending' AND expires_at > ?
       ORDER BY created_at DESC`
    )
    .all(organizationId, new Date().toISOString()) as InvitationRow[];
  return rows.map(mapInvitationFromDb);
}

/** Marks a pending invitation of the organization as revoked; returns it, or null when there was none. */
export function revokeInvitation(organizationId: string, invitationId: string): Invitation | null {
  const database = getDb();
  const result = database
    .prepare(
      `UPDATE invitations SET status = 'revoked', responded_at = ?
       WHERE id = ? AND organization_id = ? AND status = 'pending'`
    )
    .run(new Date().toISOString(), invitationId, organizationId);
  if (result.changes === 0) return null;
  const row = database.prepare("SELECT * FROM invitations WHERE id = ?").get(invitationId) as InvitationRow;
  return mapInvitationFromDb(row);
}

/**
 * Accepts every pending, unexpired invitation addressed to `email`: the user
 * joins each organization with the invited role (unless already a member) and
 * the invitations are marked accepted. Returns the invitations it consumed.
 */
export function acceptPendingInvitations(userId: string, email: string): Invitation[] {
  const database = getDb();
  const now = new Date().toISOString();

  return database.transaction(() => {
    const invitations = (
      database
        .prepare("SELECT * FROM invitations WHERE email = ? COLLATE NOCASE AND status = 'pending' AND expires_at > ?")
        .all(email, now) as InvitationRow[]
    ).map(mapInvitationFromDb);

    for (const invitation of invitations) {
      if (!getOrganizationMember(invitation.organizationId, userId)) {
        addOrganizationMember({
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
        });
      }
      database
        .prepare("UPDATE invitations SET status = 'accepted', responded_at = ? WHERE id = ?")
        .run(now, invitation.id);
    }
    return invitations;
  })();
}

// ===== Account data =====

/**
 * Deletes the user's personal projects (see PERSONAL_PROJECT_SQL) together
 * with their credentials. Organization projects are kept.
 */
export function deletePersonalProjects(userId: string): { projects: number; credentials: number } {
  const database = getDb();

  return database.transaction(() => {
    const projectIds = (
      database
        .prepare(`SELECT p.id FROM projects p WHERE p.owner_id = ? AND ${PERSONAL_PROJECT_SQL}`)
        .all(userId) as { id: string }[]
    ).map((row) => row.id);

    let credentials = 0;
    for (const projectId of projectIds) {
      credentials += database.prepare("DELETE FROM credentials WHERE project_id = ?").run(projectId).changes;
      database.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    }
    return { projects: projectIds.length, credentials };
  })();
}

// ===== Admin statistics =====

const STATS_RANGE_MS: Record<StatsRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const BRUTE_FORCE_THRESHOLD = 5;
const BRUTE_FORCE_WINDOW_MS = 10 * 60 * 1000;
const MASS_REVEAL_THRESHOLD = 10;
const MASS_REVEAL_WINDOW_MS = 60 * 60 * 1000;
/** Upper bound on raw events scanned for security alerts. */
const ALERT_SCAN_LIMIT = 20_000;

interface BurstWindow {
  count: number;
  firstSeen: string;
  lastSeen: string;
}

/** Largest number of timestamps (ascending ISO strings) that fall inside any window of `windowMs`. */
function largestBurst(timestamps: string[], windowMs: number): BurstWindow {
  let best: BurstWindow = { count: 0, firstSeen: "", lastSeen: "" };
  let start = 0;
  for (let end = 0; end < timestamps.length; end++) {
    const endTime = Date.parse(timestamps[end]);
    while (endTime - Date.parse(timestamps[start]) > windowMs) start++;
    const count = end - start + 1;
    if (count > best.count) {
      best = { count, firstSeen: timestamps[start], lastSeen: timestamps[end] };
    }
  }
  return best;
}

function groupTimestamps(rows: { key: string | null; timestamp: string }[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.key) continue;
    const list = groups.get(row.key) ?? [];
    list.push(row.timestamp);
    groups.set(row.key, list);
  }
  return groups;
}

function bucketStarts(since: Date, now: Date, granularity: "hour" | "day"): string[] {
  const cursor = new Date(since);
  if (granularity === "hour") {
    cursor.setUTCMinutes(0, 0, 0);
  } else {
    cursor.setUTCHours(0, 0, 0, 0);
  }
  const step = granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const buckets: string[] = [];
  for (let time = cursor.getTime(); time <= now.getTime(); time += step) {
    buckets.push(new Date(time).toISOString());
  }
  return buckets;
}

/**
 * Dashboard statistics for a time range. With an organization id the numbers
 * are limited to that organization (its members, projects and events);
 * without one they cover the whole platform. `system` is filled in by the caller.
 */
export function getAdminStats(range: StatsRange, organizationId: string | null): Omit<AdminStats, "system"> {
  const database = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - STATS_RANGE_MS[range]);
  const params = { org: organizationId, since: since.toISOString() };
  const scoped = organizationId !== null;

  const memberOf = (column: string) =>
    scoped ? `${column} IN (SELECT user_id FROM organization_members WHERE organization_id = @org)` : "1=1";
  const projectScope = scoped ? "p.organization_id = @org" : "1=1";
  const auditScope = scoped ? `(a.organization_id = @org OR (a.organization_id IS NULL AND ${memberOf("a.user_id")}))` : "1=1";

  const count = (sql: string) => (database.prepare(sql).get(params) as { count: number }).count;

  const users = {
    total: count(`SELECT COUNT(*) AS count FROM users u WHERE ${memberOf("u.id")}`),
    activeInRange: count(
      `SELECT COUNT(DISTINCT user_id) AS count FROM (
         SELECT a.user_id FROM audit_logs a
         WHERE a.timestamp >= @since AND a.user_id IS NOT NULL AND a.action != 'login_failed' AND ${auditScope}
         UNION
         SELECT s.user_id FROM sessions s WHERE s.last_activity >= @since AND ${memberOf("s.user_id")}
       )`
    ),
  };

  const projectCounts = database
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN ${PERSONAL_PROJECT_SQL} THEN 1 ELSE 0 END), 0) AS personal
       FROM projects p WHERE ${projectScope}`
    )
    .get(params) as { total: number; personal: number };

  const credentials = {
    total: count(`SELECT COUNT(*) AS count FROM credentials c JOIN projects p ON p.id = c.project_id WHERE ${projectScope}`),
    newInRange: count(
      `SELECT COUNT(*) AS count FROM credentials c JOIN projects p ON p.id = c.project_id
       WHERE c.created_at >= @since AND ${projectScope}`
    ),
  };

  const eventsTotal = count(`SELECT COUNT(*) AS count FROM audit_logs a WHERE a.timestamp >= @since AND ${auditScope}`);

  const failedRows = database
    .prepare(
      `SELECT a.ip_address AS ip, LOWER(json_extract(a.details, '$.username')) AS username, a.timestamp
       FROM audit_logs a
       WHERE a.action = 'login_failed' AND a.timestamp >= @since AND ${auditScope}
       ORDER BY a.timestamp ASC
       LIMIT ${ALERT_SCAN_LIMIT}`
    )
    .all(params) as { ip: string | null; username: string | null; timestamp: string }[];

  const failedSignIns = {
    total: count(
      `SELECT COUNT(*) AS count FROM audit_logs a WHERE a.action = 'login_failed' AND a.timestamp >= @since AND ${auditScope}`
    ),
    distinctIps: count(
      `SELECT COUNT(DISTINCT a.ip_address) AS count FROM audit_logs a
       WHERE a.action = 'login_failed' AND a.timestamp >= @since AND ${auditScope}`
    ),
  };

  const granularity = range === "24h" ? "hour" : "day";
  const prefixLength = granularity === "hour" ? 13 : 10;
  const activityCounts = new Map(
    (
      database
        .prepare(
          `SELECT SUBSTR(a.timestamp, 1, ${prefixLength}) AS bucket, COUNT(*) AS count
           FROM audit_logs a WHERE a.timestamp >= @since AND ${auditScope}
           GROUP BY bucket`
        )
        .all(params) as { bucket: string; count: number }[]
    ).map((row) => [row.bucket, row.count])
  );
  const series = bucketStarts(since, now, granularity).map((bucket) => ({
    bucket,
    count: activityCounts.get(bucket.slice(0, prefixLength)) ?? 0,
  }));

  const actionBreakdown = database
    .prepare(
      `SELECT a.action, COUNT(*) AS count FROM audit_logs a
       WHERE a.timestamp >= @since AND ${auditScope}
       GROUP BY a.action ORDER BY count DESC`
    )
    .all(params) as { action: string; count: number }[];

  const topContributors = (
    database
      .prepare(
        `SELECT u.id, u.username, u.first_name, u.last_name, COUNT(*) AS events
         FROM audit_logs a JOIN users u ON u.id = a.user_id
         WHERE a.timestamp >= @since AND a.action != 'login_failed' AND ${auditScope}
         GROUP BY u.id ORDER BY events DESC LIMIT 5`
      )
      .all(params) as { id: string; username: string; first_name: string; last_name: string; events: number }[]
  ).map((row) => ({
    userId: row.id,
    name: `${row.first_name} ${row.last_name}`.trim() || row.username,
    username: row.username,
    events: row.events,
  }));

  const securityAlerts: SecurityAlert[] = [];

  const bruteForceSources: [string, Map<string, string[]>][] = [
    ["username", groupTimestamps(failedRows.map((row) => ({ key: row.username, timestamp: row.timestamp })))],
    ["IP address", groupTimestamps(failedRows.map((row) => ({ key: row.ip, timestamp: row.timestamp })))],
  ];
  for (const [label, groups] of bruteForceSources) {
    for (const [subject, timestamps] of groups) {
      const burst = largestBurst(timestamps, BRUTE_FORCE_WINDOW_MS);
      if (burst.count < BRUTE_FORCE_THRESHOLD) continue;
      securityAlerts.push({
        type: "brute_force",
        severity: burst.count >= BRUTE_FORCE_THRESHOLD * 2 ? "high" : "medium",
        subject,
        userId: null,
        count: burst.count,
        firstSeen: burst.firstSeen,
        lastSeen: burst.lastSeen,
        message: `${burst.count} failed sign-ins for ${label} ${subject} within 10 minutes`,
      });
    }
  }

  const revealRows = database
    .prepare(
      `SELECT a.user_id AS key, a.timestamp FROM audit_logs a
       WHERE a.action IN ('accessed', 'revealed') AND a.timestamp >= @since AND a.user_id IS NOT NULL AND ${auditScope}
       ORDER BY a.timestamp ASC
       LIMIT ${ALERT_SCAN_LIMIT}`
    )
    .all(params) as { key: string; timestamp: string }[];

  for (const [userId, timestamps] of groupTimestamps(revealRows)) {
    const burst = largestBurst(timestamps, MASS_REVEAL_WINDOW_MS);
    if (burst.count < MASS_REVEAL_THRESHOLD) continue;
    const user = getUserById(userId);
    const subject = user ? `${user.firstName} ${user.lastName} (@${user.username})` : userId;
    securityAlerts.push({
      type: "mass_reveal",
      severity: burst.count >= MASS_REVEAL_THRESHOLD * 3 ? "high" : "medium",
      subject,
      userId,
      count: burst.count,
      firstSeen: burst.firstSeen,
      lastSeen: burst.lastSeen,
      message: `${subject} revealed ${burst.count} secrets within 1 hour`,
    });
  }

  securityAlerts.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

  return {
    range,
    scope: scoped ? "organization" : "platform",
    since: params.since,
    generatedAt: now.toISOString(),
    users,
    projects: {
      total: projectCounts.total,
      personal: projectCounts.personal,
      organization: projectCounts.total - projectCounts.personal,
    },
    credentials,
    events: { total: eventsTotal },
    failedSignIns,
    activity: { granularity, series },
    actionBreakdown,
    topContributors,
    securityAlerts,
  };
}

// ===== Utility Functions =====

export function isPlatformSetup(): boolean {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  return row.count > 0;
}

export function getFirstUser(): User | null {
  const row = getDb().prepare("SELECT * FROM users ORDER BY created_at ASC LIMIT 1").get() as UserRow | undefined;
  return row ? mapUserFromDb(row) : null;
}

/** Closes the connection (tests and graceful shutdown). */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
