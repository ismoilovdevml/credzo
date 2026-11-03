import crypto from "crypto";
import type Database from "better-sqlite3";
import { getDb } from "./db";

/**
 * One-time secure links (zero-knowledge).
 *
 * The browser encrypts the secret with AES-GCM using a random key that only
 * ever lives in the URL fragment (optionally mixed with a passphrase via
 * PBKDF2). The server stores opaque ciphertext and enforces expiry, view
 * limits and revocation. It never sees the key or the passphrase.
 *
 * Binary fields (ciphertext, iv, salt) travel as base64 or base64url strings.
 */

export const SHARE_EXPIRY_OPTIONS = ["1h", "24h", "7d"] as const;
export type ShareExpiry = (typeof SHARE_EXPIRY_OPTIONS)[number];

export const SHARE_MAX_VIEWS_OPTIONS = [1, 3] as const;
export type ShareMaxViews = (typeof SHARE_MAX_VIEWS_OPTIONS)[number];

export type ShareStatus = "active" | "opened" | "expired" | "revoked";

/** Audit trail identifiers (not part of the AuditAction/AuditResource enums). */
export const SHARE_AUDIT_RESOURCE = "share";
export const SHARE_AUDIT_ACTIONS = {
  CREATED: "share_created",
  REVOKED: "share_revoked",
  OPENED: "share_opened",
} as const;

/** Maximum decoded ciphertext size (AES-GCM output incl. 16-byte tag). */
export const MAX_SHARE_CIPHERTEXT_BYTES = 64 * 1024;
/** Maximum accepted request body for share creation (base64 overhead + JSON). */
export const MAX_SHARE_REQUEST_BYTES = 96 * 1024;
export const MAX_SHARE_LABEL_LENGTH = 120;
/** Cap on simultaneously active links per user to bound storage abuse. */
export const MAX_ACTIVE_SHARES_PER_USER = 100;

const AES_GCM_IV_BYTES = 12;
const MIN_SALT_BYTES = 16;
const MAX_SALT_BYTES = 64;
/** Minimum ciphertext: the 16-byte GCM authentication tag plus one byte. */
const MIN_CIPHERTEXT_BYTES = 17;
/** Finished links stay listed (without ciphertext) for this long after expiry. */
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_LIMIT = 100;

const EXPIRY_MS: Record<ShareExpiry, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const BASE64_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/;
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export interface CreateShareInput {
  label: string | null;
  ciphertext: string;
  iv: string;
  salt: string | null;
  requiresPassphrase: boolean;
  maxViews: ShareMaxViews;
  expiresIn: ShareExpiry;
}

export interface ShareSummary {
  id: string;
  label: string | null;
  maxViews: number;
  views: number;
  requiresPassphrase: boolean;
  expiresAt: string;
  createdAt: string;
  lastOpenedAt: string | null;
  revokedAt: string | null;
  status: ShareStatus;
}

export type ShareMeta =
  | {
      exists: true;
      requiresPassphrase: boolean;
      expiresAt: string;
      viewsLeft: number;
    }
  | {
      exists: false;
      reason: "not_found" | "expired" | "revoked" | "consumed";
    };

export interface SharePayload {
  ciphertext: string;
  iv: string;
  salt: string | null;
  requiresPassphrase: boolean;
  viewsLeft: number;
}

export type OpenShareResult =
  | { ok: true; ownerId: string; organizationId: string | null; payload: SharePayload }
  | { ok: false; reason: "not_found" | "expired" | "revoked" | "consumed" };

interface ShareRow {
  id: string;
  owner_id: string;
  organization_id: string | null;
  label: string | null;
  ciphertext: string | null;
  iv: string | null;
  salt: string | null;
  requires_passphrase: number;
  max_views: number;
  views: number;
  expires_at: string;
  created_at: string;
  last_opened_at: string | null;
  revoked_at: string | null;
}

let schemaReady = false;

function sharesDb(): Database.Database {
  const database = getDb();
  if (!schemaReady) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        organization_id TEXT,
        label TEXT,
        ciphertext TEXT,
        iv TEXT,
        salt TEXT,
        requires_passphrase INTEGER NOT NULL DEFAULT 0,
        max_views INTEGER NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_opened_at TEXT,
        revoked_at TEXT,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);
    `);
    schemaReady = true;
  }
  return database;
}

function decodedLength(value: string): number {
  return Buffer.from(value, "base64").length;
}

function isBase64(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && BASE64_PATTERN.test(value);
}

export function isValidShareId(id: string): boolean {
  return SHARE_ID_PATTERN.test(id);
}

function generateShareId(): string {
  // 128 bits of randomness, url-safe, 22 characters.
  return crypto.randomBytes(16).toString("base64url");
}

function statusOf(row: ShareRow, nowIso: string): ShareStatus {
  if (row.revoked_at) return "revoked";
  if (row.views >= row.max_views) return "opened";
  if (row.expires_at <= nowIso) return "expired";
  return "active";
}

function toSummary(row: ShareRow, nowIso: string): ShareSummary {
  return {
    id: row.id,
    label: row.label,
    maxViews: row.max_views,
    views: row.views,
    requiresPassphrase: row.requires_passphrase === 1,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
    revokedAt: row.revoked_at,
    status: statusOf(row, nowIso),
  };
}

/**
 * Validate an untrusted request body for share creation.
 */
export function parseCreateShareInput(
  body: unknown
): { ok: true; value: CreateShareInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }
  const input = body as Record<string, unknown>;

  let label: string | null = null;
  if (input.label !== undefined && input.label !== null) {
    if (typeof input.label !== "string") {
      return { ok: false, error: "Label must be a string" };
    }
    const trimmed = input.label.trim();
    if (trimmed.length > MAX_SHARE_LABEL_LENGTH) {
      return { ok: false, error: `Label must be at most ${MAX_SHARE_LABEL_LENGTH} characters` };
    }
    label = trimmed || null;
  }

  if (!isBase64(input.ciphertext)) {
    return { ok: false, error: "Ciphertext must be a base64 string" };
  }
  const ciphertextBytes = decodedLength(input.ciphertext);
  if (ciphertextBytes < MIN_CIPHERTEXT_BYTES) {
    return { ok: false, error: "Ciphertext is too short" };
  }
  if (ciphertextBytes > MAX_SHARE_CIPHERTEXT_BYTES) {
    return { ok: false, error: "Secret is too large (max 64 KB encrypted)" };
  }

  if (!isBase64(input.iv) || decodedLength(input.iv) !== AES_GCM_IV_BYTES) {
    return { ok: false, error: `IV must be ${AES_GCM_IV_BYTES} bytes, base64 encoded` };
  }

  if (typeof input.requiresPassphrase !== "boolean") {
    return { ok: false, error: "requiresPassphrase must be a boolean" };
  }

  let salt: string | null = null;
  if (input.salt !== undefined && input.salt !== null && input.salt !== "") {
    if (!isBase64(input.salt)) {
      return { ok: false, error: "Salt must be a base64 string" };
    }
    const saltBytes = decodedLength(input.salt);
    if (saltBytes < MIN_SALT_BYTES || saltBytes > MAX_SALT_BYTES) {
      return {
        ok: false,
        error: `Salt must be between ${MIN_SALT_BYTES} and ${MAX_SALT_BYTES} bytes`,
      };
    }
    salt = input.salt;
  }
  if (input.requiresPassphrase && !salt) {
    return { ok: false, error: "A salt is required when a passphrase is used" };
  }

  if (!SHARE_MAX_VIEWS_OPTIONS.includes(input.maxViews as ShareMaxViews)) {
    return { ok: false, error: `maxViews must be one of ${SHARE_MAX_VIEWS_OPTIONS.join(", ")}` };
  }

  if (!SHARE_EXPIRY_OPTIONS.includes(input.expiresIn as ShareExpiry)) {
    return { ok: false, error: `expiresIn must be one of ${SHARE_EXPIRY_OPTIONS.join(", ")}` };
  }

  return {
    ok: true,
    value: {
      label,
      ciphertext: input.ciphertext,
      iv: input.iv,
      salt,
      requiresPassphrase: input.requiresPassphrase,
      maxViews: input.maxViews as ShareMaxViews,
      expiresIn: input.expiresIn as ShareExpiry,
    },
  };
}

/**
 * Wipe ciphertext of links that expired and drop rows whose history window
 * has passed. Safe to call on any request.
 */
export function purgeExpiredShares(now: Date = new Date()): void {
  const database = sharesDb();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - HISTORY_RETENTION_MS).toISOString();
  database
    .prepare(
      `UPDATE shares SET ciphertext = NULL, iv = NULL, salt = NULL
       WHERE expires_at <= ? AND ciphertext IS NOT NULL`
    )
    .run(nowIso);
  database.prepare("DELETE FROM shares WHERE expires_at <= ?").run(cutoffIso);
}

export function countActiveShares(ownerId: string, now: Date = new Date()): number {
  const row = sharesDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM shares
       WHERE owner_id = ? AND revoked_at IS NULL AND views < max_views AND expires_at > ?`
    )
    .get(ownerId, now.toISOString()) as { count: number };
  return row.count;
}

export function createShare(
  ownerId: string,
  organizationId: string | null,
  input: CreateShareInput
): { id: string; expiresAt: string } {
  purgeExpiredShares();
  const now = new Date();
  const id = generateShareId();
  const expiresAt = new Date(now.getTime() + EXPIRY_MS[input.expiresIn]).toISOString();

  sharesDb()
    .prepare(
      `INSERT INTO shares (
        id, owner_id, organization_id, label, ciphertext, iv, salt,
        requires_passphrase, max_views, views, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      id,
      ownerId,
      organizationId,
      input.label,
      input.ciphertext,
      input.iv,
      input.salt,
      input.requiresPassphrase ? 1 : 0,
      input.maxViews,
      expiresAt,
      now.toISOString()
    );

  return { id, expiresAt };
}

export function listSharesForUser(ownerId: string): ShareSummary[] {
  purgeExpiredShares();
  const nowIso = new Date().toISOString();
  const rows = sharesDb()
    .prepare(
      `SELECT * FROM shares WHERE owner_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(ownerId, LIST_LIMIT) as ShareRow[];
  return rows.map((row) => toSummary(row, nowIso));
}

export function getShareOwnerId(id: string): string | null {
  const row = sharesDb()
    .prepare("SELECT owner_id FROM shares WHERE id = ?")
    .get(id) as { owner_id: string } | undefined;
  return row ? row.owner_id : null;
}

/**
 * Revoke a link and wipe its ciphertext. Idempotent: `revoked` is true only
 * when this call changed the link. Returns null when the link does not exist.
 */
export function revokeShare(id: string): { share: ShareSummary; revoked: boolean } | null {
  const database = sharesDb();
  const nowIso = new Date().toISOString();
  const result = database
    .prepare(
      `UPDATE shares
       SET revoked_at = ?, ciphertext = NULL, iv = NULL, salt = NULL
       WHERE id = ? AND revoked_at IS NULL`
    )
    .run(nowIso, id);
  const row = database.prepare("SELECT * FROM shares WHERE id = ?").get(id) as
    | ShareRow
    | undefined;
  return row ? { share: toSummary(row, nowIso), revoked: result.changes > 0 } : null;
}

function unavailableReason(
  row: ShareRow,
  nowIso: string
): "expired" | "revoked" | "consumed" | null {
  if (row.revoked_at) return "revoked";
  if (row.views >= row.max_views) return "consumed";
  if (row.expires_at <= nowIso || !row.ciphertext || !row.iv) return "expired";
  return null;
}

/**
 * Public metadata for the recipient page. Does not consume a view.
 */
export function getShareMeta(id: string): ShareMeta {
  const row = sharesDb().prepare("SELECT * FROM shares WHERE id = ?").get(id) as
    | ShareRow
    | undefined;
  if (!row) return { exists: false, reason: "not_found" };

  const reason = unavailableReason(row, new Date().toISOString());
  if (reason) return { exists: false, reason };

  return {
    exists: true,
    requiresPassphrase: row.requires_passphrase === 1,
    expiresAt: row.expires_at,
    viewsLeft: row.max_views - row.views,
  };
}

/**
 * Atomically consume one view and return the encrypted payload. The
 * ciphertext is wiped in the same transaction once the last view is used.
 */
export function openShare(id: string): OpenShareResult {
  const database = sharesDb();

  const consume = database.transaction((shareId: string): OpenShareResult => {
    const row = database.prepare("SELECT * FROM shares WHERE id = ?").get(shareId) as
      | ShareRow
      | undefined;
    if (!row) return { ok: false, reason: "not_found" };

    const nowIso = new Date().toISOString();
    const reason = unavailableReason(row, nowIso);
    if (reason) {
      if (reason === "expired" && row.ciphertext) {
        database
          .prepare("UPDATE shares SET ciphertext = NULL, iv = NULL, salt = NULL WHERE id = ?")
          .run(shareId);
      }
      return { ok: false, reason };
    }

    const views = row.views + 1;
    const exhausted = views >= row.max_views;
    database
      .prepare(
        `UPDATE shares
         SET views = ?, last_opened_at = ?,
             ciphertext = CASE WHEN ? THEN NULL ELSE ciphertext END,
             iv = CASE WHEN ? THEN NULL ELSE iv END,
             salt = CASE WHEN ? THEN NULL ELSE salt END
         WHERE id = ?`
      )
      .run(views, nowIso, exhausted ? 1 : 0, exhausted ? 1 : 0, exhausted ? 1 : 0, shareId);

    return {
      ok: true,
      ownerId: row.owner_id,
      organizationId: row.organization_id,
      payload: {
        ciphertext: row.ciphertext as string,
        iv: row.iv as string,
        salt: row.salt,
        requiresPassphrase: row.requires_passphrase === 1,
        viewsLeft: row.max_views - views,
      },
    };
  });

  return consume.immediate(id);
}

// ===== In-memory rate limiting (per process) =====

interface RateWindow {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_SWEEP_THRESHOLD = 10_000;

// Cached on globalThis so dev-mode hot reloads do not reset the counters.
const rateRegistry = globalThis as typeof globalThis & {
  __credzoShareRateWindows?: Map<string, RateWindow>;
};

/**
 * Fixed-window rate limiter for the public share endpoints. Every call counts
 * as a hit. Returns the number of seconds to wait when the limit is exceeded,
 * or 0 when the request is allowed.
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number): number {
  rateRegistry.__credzoShareRateWindows ??= new Map();
  const rateWindows = rateRegistry.__credzoShareRateWindows;
  const now = Date.now();

  if (rateWindows.size > RATE_LIMIT_SWEEP_THRESHOLD) {
    for (const [entryKey, entry] of rateWindows) {
      if (entry.resetAt <= now) rateWindows.delete(entryKey);
    }
  }

  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  if (current.count >= limit) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  }
  current.count += 1;
  return 0;
}
