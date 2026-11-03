import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  acceptPendingInvitations,
  cleanupExpiredSessions,
  consumeBackupCode,
  createAuditLog,
  createLoginChallenge,
  createOrganization,
  createSession,
  createUser,
  deleteLoginChallenge,
  deleteSession,
  deleteSessionById,
  getDb,
  getLoginChallenge,
  getOrganizationBySlug,
  getSessionByToken,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  getUserOrganizationMemberships,
  getUserTwoFactorState,
  isPlatformSetup,
  recordLoginChallengeFailure,
  replaceUserPasswordHash,
  setTotpLastUsedStep,
  touchSession,
  updateUserLastLogin,
} from "./db";
import { generateToken, hashBackupCode, safeEqual, sha256Hex, verifyTotp } from "./crypto-server";
import { isClientIpTrusted, loginLimiter, passwordCheckLimiter, twoFactorLimiter } from "./rate-limit";
import { SESSION_CONFIG } from "./config/constants";
import { ConflictError, ValidationError } from "./utils/errors";
import type { AuthContext, PublicUser, User } from "./types";
import { AuditAction, AuditResource, UserRole } from "./types";

// ===== Configuration =====

export const SESSION_COOKIE_NAME = SESSION_CONFIG.COOKIE_NAME;
/** Optional, non-secret cookie holding the organization the user switched to. */
export const ACTIVE_ORG_COOKIE_NAME = "active_org";

/** "Keep me signed in" sessions: 7 days, sliding. */
const PERSISTENT_SESSION_MS = SESSION_CONFIG.DURATION;
/** Browser-session sessions: 12 hours, sliding. */
const BROWSER_SESSION_MS = 12 * 60 * 60 * 1000;
/** last_activity / expires_at are rewritten at most once per minute per session. */
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
const LOGIN_CHALLENGE_MS = 5 * 60 * 1000;
const LOGIN_CHALLENGE_MAX_ATTEMPTS = 5;

export const PASSWORD_MIN_LENGTH = 10;
/** Upper bound keeps scrypt work per request predictable. */
export const PASSWORD_MAX_LENGTH = 256;

// ===== Password hashing (scrypt) =====
// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>. Unsalted SHA-256
// hex digests from older releases are still accepted and upgraded on sign-in.

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const LEGACY_SHA256_PATTERN = /^[0-9a-f]{64}$/;

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

function scrypt(password: string, salt: Buffer, keyLength: number, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize("NFKC"),
      salt,
      keyLength,
      { ...params, maxmem: 256 * params.N * params.r },
      (error, key) => (error ? reject(error) : resolve(key))
    );
  });
}

function parseScryptHash(stored: string): { params: ScryptParams; salt: Buffer; hash: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [N, r, p] = parts.slice(1, 4).map(Number);
  const validParams =
    Number.isInteger(N) && N >= 2 && N <= 2 ** 20 && (N & (N - 1)) === 0 &&
    Number.isInteger(r) && r >= 1 && r <= 32 &&
    Number.isInteger(p) && p >= 1 && p <= 16;
  if (!validParams) return null;

  const salt = Buffer.from(parts[4], "base64");
  const hash = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || hash.length === 0) return null;

  return { params: { N, r, p }, salt, hash };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH);
  const params = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P };
  const hash = await scrypt(password, salt, SCRYPT_KEY_LENGTH, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (LEGACY_SHA256_PATTERN.test(stored)) {
    return safeEqual(sha256Hex(password), stored);
  }

  const parsed = parseScryptHash(stored);
  if (!parsed) return false;

  const candidate = await scrypt(password, parsed.salt, parsed.hash.length, parsed.params);
  return crypto.timingSafeEqual(candidate, parsed.hash);
}

/** True for legacy hashes and scrypt hashes made with weaker parameters. */
export function passwordNeedsRehash(stored: string): boolean {
  const parsed = parseScryptHash(stored);
  return !parsed || parsed.params.N < SCRYPT_N || parsed.params.r < SCRYPT_R || parsed.params.p < SCRYPT_P;
}

let dummyHash: Promise<string> | null = null;

/** Spends the same work as a real verification so unknown usernames are not revealed by timing. */
async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(generateToken(16));
  await verifyPassword(password, await dummyHash);
}

/** Throws ValidationError unless the password satisfies the policy. */
export function assertPasswordPolicy(password: string, label: string = "Password"): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ValidationError(`${label} must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new ValidationError(`${label} must not exceed ${PASSWORD_MAX_LENGTH} characters`);
  }
}

export type PasswordCheckResult = { ok: true } | { ok: false; retryAfterSeconds?: number };

/**
 * Re-authenticates a signed-in user (password change, 2FA disable, data
 * deletion). Wrong passwords are rate limited per user.
 */
export async function checkCurrentPassword(user: User, password: string): Promise<PasswordCheckResult> {
  const status = passwordCheckLimiter.check(user.id);
  if (status.limited) return { ok: false, retryAfterSeconds: status.retryAfterSeconds };

  if (await verifyPassword(password, user.passwordHash)) {
    passwordCheckLimiter.reset(user.id);
    return { ok: true };
  }

  passwordCheckLimiter.hit(user.id);
  return { ok: false };
}

// ===== Public user shape =====

/** Strips the password hash; 2FA secrets and backup codes never leave lib/db.ts. */
export function toPublicUser(user: User): PublicUser {
  const publicUser: Partial<User> = { ...user };
  delete publicUser.passwordHash;
  return publicUser as PublicUser;
}

// ===== Cookies =====

function shouldUseSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

/** Persistent sessions get a 7-day cookie; others last until the browser closes. */
export function setSessionCookie(response: NextResponse, token: string, persistent: boolean): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    ...(persistent && { maxAge: Math.floor(PERSISTENT_SESSION_MS / 1000) }),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function setActiveOrganizationCookie(response: NextResponse, organizationId: string): void {
  response.cookies.set(ACTIVE_ORG_COOKIE_NAME, organizationId, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

// ===== Sessions =====

function sessionExpiry(persistent: boolean): string {
  return new Date(Date.now() + (persistent ? PERSISTENT_SESSION_MS : BROWSER_SESSION_MS)).toISOString();
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

function primaryOrganizationId(userId: string): string | undefined {
  return getUserOrganizationMemberships(userId)[0]?.organization.id;
}

/** Adds the user to every organization with a pending invitation for their email. */
function claimInvitations(user: User, meta: RequestMeta): void {
  for (const invitation of acceptPendingInvitations(user.id, user.email)) {
    createAuditLog({
      userId: user.id,
      organizationId: invitation.organizationId,
      action: AuditAction.CREATED,
      resourceType: AuditResource.MEMBER,
      resourceId: user.id,
      details: { context: "invitation_accepted", invitationId: invitation.id, email: invitation.email, role: invitation.role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

/**
 * Creates a session for an authenticated user (claiming pending invitations
 * first) and returns the raw token for the cookie.
 */
function startSession(user: User, persistent: boolean, meta: RequestMeta, method: string): string {
  cleanupExpiredSessions();
  claimInvitations(user, meta);

  const token = generateToken(SESSION_CONFIG.TOKEN_LENGTH);
  createSession({
    userId: user.id,
    token,
    expiresAt: sessionExpiry(persistent),
    persistent,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  updateUserLastLogin(user.id);

  createAuditLog({
    userId: user.id,
    organizationId: primaryOrganizationId(user.id),
    action: AuditAction.LOGIN,
    resourceType: AuditResource.USER,
    resourceId: user.id,
    details: { username: user.username, method },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return token;
}

/**
 * Picks the organization the auth context works in: the requested one when the
 * user belongs to it, else the most recently joined organization the user does
 * not own (a team they were added to), else their own workspace.
 */
function resolveActiveOrganization(userId: string, requestedId: string | undefined) {
  const memberships = getUserOrganizationMemberships(userId);
  const active =
    memberships.find((m) => m.organization.id === requestedId) ??
    memberships.find((m) => m.organization.ownerId !== userId) ??
    memberships[0];
  return { memberships, active };
}

async function readActiveOrganizationCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(ACTIVE_ORG_COOKIE_NAME)?.value;
  } catch {
    // Called outside a request scope (scripts, tests).
    return undefined;
  }
}

/**
 * Resolves a raw session token to an auth context, sliding the session expiry.
 * Returns null for unknown or expired sessions. The active organization comes
 * from `activeOrganizationId` or, when omitted, the active_org request cookie.
 */
export async function validateSession(
  token: string,
  options: { activeOrganizationId?: string } = {}
): Promise<AuthContext | null> {
  if (!token) return null;

  const session = getSessionByToken(token);
  if (!session) return null;

  if (Date.parse(session.expiresAt) <= Date.now()) {
    deleteSessionById(session.id);
    return null;
  }

  const user = getUserById(session.userId);
  if (!user) {
    deleteSessionById(session.id);
    return null;
  }

  if (Date.now() - Date.parse(session.lastActivity) > SESSION_TOUCH_INTERVAL_MS) {
    touchSession(session.id, sessionExpiry(session.persistent));
  }

  const requestedOrganizationId = options.activeOrganizationId ?? (await readActiveOrganizationCookie());
  const { memberships, active } = resolveActiveOrganization(user.id, requestedOrganizationId);

  return {
    user,
    sessionId: session.id,
    organization: active?.organization,
    organizationRole: active?.role,
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
    permissions: getPermissionsForRole(user.role, active?.role),
  };
}

/** Whether the session behind a raw token is a "keep me signed in" one (for refreshing its cookie). */
export function isPersistentSession(token: string): boolean {
  return getSessionByToken(token)?.persistent ?? false;
}

export function logout(token: string, meta: RequestMeta = {}): void {
  const session = getSessionByToken(token);
  if (!session) return;

  const user = getUserById(session.userId);
  if (user) {
    createAuditLog({
      userId: user.id,
      organizationId: primaryOrganizationId(user.id),
      action: AuditAction.LOGOUT,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      details: { username: user.username },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  deleteSession(token);
}

// ===== Sign-up =====

function uniqueOrganizationSlug(username: string): string {
  const base = username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
  let slug = base;
  for (let suffix = 2; getOrganizationBySlug(slug); suffix++) {
    slug = `${base}-${suffix}`;
  }
  return slug;
}

/**
 * Registers a user (the very first one becomes platform admin), creates their
 * workspace organization and signs them in. Input must already be validated;
 * throws ConflictError for a taken username or email.
 */
export async function signup(
  data: { username: string; email: string; password: string; firstName: string; lastName: string },
  meta: RequestMeta = {}
): Promise<{ user: User; token: string }> {
  assertPasswordPolicy(data.password);
  const passwordHash = await hashPassword(data.password);

  const user = getDb().transaction(() => {
    if (getUserByUsername(data.username)) throw new ConflictError("Username is already taken");
    if (getUserByEmail(data.email)) throw new ConflictError("An account with this email already exists");

    const isFirstUser = !isPlatformSetup();
    const created = createUser({
      username: data.username,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: isFirstUser ? UserRole.PLATFORM_ADMIN : UserRole.USER,
    });

    const organization = createOrganization({
      name: `${data.firstName}'s Organization`,
      slug: uniqueOrganizationSlug(data.username),
      description: isFirstUser ? "Default organization" : `${data.firstName}'s personal workspace`,
      ownerId: created.id,
    });

    createAuditLog({
      userId: created.id,
      organizationId: organization.id,
      action: AuditAction.CREATED,
      resourceType: AuditResource.USER,
      resourceId: created.id,
      details: { username: created.username, isFirstUser },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    createAuditLog({
      userId: created.id,
      organizationId: organization.id,
      action: AuditAction.CREATED,
      resourceType: AuditResource.ORGANIZATION,
      resourceId: organization.id,
      details: { organizationName: organization.name, isFirstUser },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  })();

  const token = startSession(user, true, meta, "signup");
  return { user: getUserById(user.id)!, token };
}

// ===== Sign-in =====

export type LoginResult =
  | { status: "success"; user: User; token: string; persistent: boolean }
  | { status: "two_factor_required"; challenge: string }
  | { status: "invalid" }
  | { status: "rate_limited"; retryAfterSeconds: number };

function recordFailedLogin(username: string, user: User | null, reason: string, meta: RequestMeta): void {
  createAuditLog({
    userId: user?.id ?? null,
    organizationId: user ? primaryOrganizationId(user.id) : null,
    action: AuditAction.LOGIN_FAILED,
    resourceType: AuditResource.USER,
    resourceId: user?.id,
    details: { username, reason },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/**
 * Password sign-in by username or email. Failures are counted per IP +
 * identifier (5 per 10 minutes) and audited as login_failed. When the account
 * has 2FA enabled no session is created; a 5-minute challenge is returned for
 * completeTwoFactorLogin instead.
 */
export async function login(
  data: { identifier: string; password: string; persistent: boolean },
  meta: RequestMeta = {}
): Promise<LoginResult> {
  const identifier = data.identifier.trim();
  // Without a trusted proxy the IP is client-controlled, so limit per account only.
  const ipPart = isClientIpTrusted() ? (meta.ipAddress ?? "unknown") : "*";
  const limiterKey = `${ipPart}|${identifier.toLowerCase()}`;

  const limit = loginLimiter.check(limiterKey);
  if (limit.limited) return { status: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };

  const user = getUserByUsername(identifier) ?? getUserByEmail(identifier);
  if (!user) await burnPasswordCheck(data.password);
  const valid = user ? await verifyPassword(data.password, user.passwordHash) : false;

  if (!user || !valid) {
    loginLimiter.hit(limiterKey);
    recordFailedLogin(identifier, user, user ? "invalid_password" : "unknown_user", meta);
    return { status: "invalid" };
  }

  loginLimiter.reset(limiterKey);
  if (passwordNeedsRehash(user.passwordHash)) {
    replaceUserPasswordHash(user.id, await hashPassword(data.password));
  }

  if (user.totpEnabled) {
    const challenge = createLoginChallenge({
      userId: user.id,
      persistent: data.persistent,
      expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_MS).toISOString(),
    });
    return { status: "two_factor_required", challenge };
  }

  const token = startSession(user, data.persistent, meta, "password");
  return { status: "success", user, token, persistent: data.persistent };
}

/**
 * Checks a TOTP code (replay-protected) or consumes a one-time backup code.
 * Returns the method that matched, or null.
 */
export function verifySecondFactor(userId: string, code: string): "totp" | "backup_code" | null {
  const state = getUserTwoFactorState(userId);
  if (!state?.enabled || !state.secret) return null;

  const normalized = code.replace(/\s/g, "");
  if (/^\d{6}$/.test(normalized)) {
    const step = verifyTotp(state.secret, normalized, { lastUsedStep: state.lastUsedStep });
    if (step === null) return null;
    setTotpLastUsedStep(userId, step);
    return "totp";
  }

  return consumeBackupCode(userId, hashBackupCode(normalized)) ? "backup_code" : null;
}

export type TwoFactorLoginResult =
  | { status: "success"; user: User; token: string; persistent: boolean }
  | { status: "invalid_challenge" }
  | { status: "invalid_code" }
  | { status: "rate_limited"; retryAfterSeconds: number };

/** Second sign-in step: a challenge allows 5 wrong codes; each IP 10 per 10 minutes. */
export function completeTwoFactorLogin(
  data: { challenge: string; code: string },
  meta: RequestMeta = {}
): TwoFactorLoginResult {
  const challenge = getLoginChallenge(data.challenge);
  const user = challenge ? getUserById(challenge.userId) : null;
  if (!challenge || !user) return { status: "invalid_challenge" };

  // Per IP behind a trusted proxy, otherwise per account (the IP could be spoofed).
  const ipKey = isClientIpTrusted() ? (meta.ipAddress ?? "unknown") : `user:${user.id}`;
  const limit = twoFactorLimiter.check(ipKey);
  if (limit.limited) return { status: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };

  const method = verifySecondFactor(user.id, data.code);
  if (!method) {
    twoFactorLimiter.hit(ipKey);
    if (recordLoginChallengeFailure(challenge.id) >= LOGIN_CHALLENGE_MAX_ATTEMPTS) {
      deleteLoginChallenge(challenge.id);
    }
    recordFailedLogin(user.username, user, "invalid_2fa_code", meta);
    return { status: "invalid_code" };
  }

  deleteLoginChallenge(challenge.id);
  const token = startSession(user, challenge.persistent, meta, method);
  return { status: "success", user, token, persistent: challenge.persistent };
}

// ===== Permissions =====

function getPermissionsForRole(userRole: string, organizationRole?: string): string[] {
  if (userRole === UserRole.PLATFORM_ADMIN) {
    return ["organization:*", "project:*", "credential:*", "member:*", "audit:read", "admin:access"];
  }

  const permissions: string[] = [];
  switch (organizationRole) {
    case "owner":
      permissions.push(
        "organization:read",
        "organization:update",
        "organization:delete",
        "project:create",
        "project:read",
        "project:update",
        "project:delete",
        "credential:create",
        "credential:read",
        "credential:update",
        "credential:delete",
        "member:invite",
        "member:remove",
        "member:update_role",
        "audit:read"
      );
      break;
    case "admin":
      permissions.push(
        "organization:read",
        "organization:update",
        "project:create",
        "project:read",
        "project:update",
        "project:delete",
        "credential:create",
        "credential:read",
        "credential:update",
        "credential:delete",
        "member:invite",
        "member:remove",
        "audit:read"
      );
      break;
    case "member":
      permissions.push(
        "organization:read",
        "project:create",
        "project:read",
        "project:update",
        "credential:create",
        "credential:read",
        "credential:update",
        "credential:delete"
      );
      break;
    case "viewer":
      permissions.push("organization:read", "project:read", "credential:read");
      break;
  }

  // All users can manage their personal projects
  permissions.push("personal:project:*", "personal:credential:*");
  return permissions;
}

/** Checks an exact permission or a category wildcard such as "project:*". */
export function hasPermission(context: AuthContext, permission: string): boolean {
  const [category] = permission.split(":");
  return (
    context.permissions.includes("*") ||
    context.permissions.includes(permission) ||
    context.permissions.includes(`${category}:*`)
  );
}

export function isPlatformAdmin(user: User): boolean {
  return user.role === UserRole.PLATFORM_ADMIN;
}

// ===== Housekeeping =====

const housekeeping = globalThis as typeof globalThis & { __credzoSessionCleanup?: NodeJS.Timeout };

if (!housekeeping.__credzoSessionCleanup) {
  housekeeping.__credzoSessionCleanup = setInterval(() => {
    try {
      cleanupExpiredSessions();
    } catch (error) {
      console.error("Session cleanup failed:", error);
    }
  }, SESSION_CONFIG.CLEANUP_INTERVAL);
  // Never keep the process (scripts, tests) alive just for cleanup.
  housekeeping.__credzoSessionCleanup.unref();
}
