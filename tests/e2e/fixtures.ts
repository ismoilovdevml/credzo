import { createHmac, randomBytes } from "node:crypto";
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ADMIN_STORAGE_STATE, originHeaders } from "./env";

export { ADMIN_PASSWORD, ADMIN_STORAGE_STATE, ADMIN_USER, BASE_URL, originHeaders } from "./env";

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Returns `<prefix>_<random>`; safe for usernames (letters, digits, underscore). */
export function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

/**
 * Signs up a brand-new user through the public API.
 * The given request context ends up signed in as that user.
 */
export async function createUserViaApi(request: APIRequestContext): Promise<TestUser> {
  const username = uniqueName("user");
  const user = {
    username,
    email: `${username}@example.com`,
    password: `pw-${randomBytes(8).toString("hex")}`,
    firstName: "Test",
    lastName: username,
  };
  const res = await request.post("/api/auth/signup", {
    data: user,
    headers: originHeaders(),
  });
  expect(res.ok(), `signup failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  const id: string | undefined = body.user?.id ?? body.data?.user?.id ?? body.data?.id;
  expect(id, "signup response did not include a user id").toBeTruthy();
  return { id: id as string, ...user };
}

/** Logs in through the API; the request context keeps the session cookie. */
export async function apiLogin(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<void> {
  const res = await request.post("/api/auth/login", {
    data: { username, password },
    headers: originHeaders(),
  });
  expect(res.ok(), `login failed for ${username}: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** Logs in through the sign-in form and waits for the dashboard. */
export async function loginViaUi(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/username or email/i).fill(username);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/);
}

export const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, provide, testInfo) => {
    // Reuse the project's device + baseURL settings, signed in as the admin.
    const context = await browser.newContext({
      ...testInfo.project.use,
      storageState: ADMIN_STORAGE_STATE,
    });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});

export { expect };

// ===== Fresh users, client IPs, hydration and TOTP (auth / settings / generator specs) =====

/**
 * Random private IPv4 for X-Forwarded-For. The server keys its rate limits by
 * client IP (10 sign-ups per hour, share opens, 2FA failures), so tests that
 * sign up users send a fresh IP to stay independent of each other.
 */
export function randomIp(): string {
  const bytes = randomBytes(3);
  return `10.${bytes[0]}.${bytes[1]}.${bytes[2]}`;
}

export function fakeIpHeaders(ip: string = randomIp()): Record<string, string> {
  return { "X-Forwarded-For": ip };
}

export interface NewUserOptions {
  prefix?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

/**
 * Signs up a brand-new user (own personal workspace) from a random client IP.
 * The given request context — e.g. `page.request`, which shares the page's
 * cookies — ends up signed in as that user.
 */
export async function signupUser(request: APIRequestContext, options: NewUserOptions = {}): Promise<TestUser> {
  const username = uniqueName(options.prefix ?? "qa");
  const user = {
    username,
    email: `${username}@example.com`,
    password: options.password ?? `pw-${randomBytes(8).toString("hex")}`,
    firstName: options.firstName ?? "Quinn",
    lastName: options.lastName ?? "Tester",
  };
  const res = await request.post("/api/auth/signup", {
    data: user,
    headers: { ...originHeaders(), ...fakeIpHeaders() },
  });
  expect(res.status(), `signup failed: ${await res.text()}`).toBe(201);
  const body = await res.json();
  return { id: body.user.id as string, ...user };
}

/** Browser context (same device settings as the running project) whose requests come from a random client IP. */
export async function newIsolatedContext(
  browser: import("@playwright/test").Browser,
  testInfo: import("@playwright/test").TestInfo,
  options: import("@playwright/test").BrowserContextOptions = {},
): Promise<import("@playwright/test").BrowserContext> {
  return browser.newContext({
    ...testInfo.project.use,
    ...options,
    extraHTTPHeaders: { ...fakeIpHeaders(), ...options.extraHTTPHeaders },
  });
}

/** Creates a project in the caller's default workspace through the API and returns its id. */
export async function createProjectViaApi(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post("/api/projects", { data: { name }, headers: originHeaders() });
  expect(res.status(), `create project failed: ${await res.text()}`).toBe(201);
  return (await res.json()).data.id as string;
}

/**
 * Waits until React has hydrated the element (client handlers attached), so a
 * click or fill isn't lost on server-rendered markup.
 */
export async function waitForHydration(locator: import("@playwright/test").Locator): Promise<void> {
  await expect
    .poll(
      () =>
        locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps") || key.startsWith("__reactFiber"))),
      { message: "element was never hydrated by React" },
    )
    .toBe(true);
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input.replace(/[\s=-]/g, "").toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`invalid base32 character "${char}"`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 TOTP (HMAC-SHA1, 30 s step, 6 digits) for a base32 secret; spaces in the secret are ignored. */
export function totp(secret: string, timeMs: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

/** Signs in through the form (data-testids) and waits until the URL leaves /login. Does not handle 2FA. */
export async function signInViaUi(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto("/login");
  await waitForHydration(page.getByTestId("login-submit"));
  await page.getByTestId("login-username").fill(identifier);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

// ---------------------------------------------------------------------------
// Role-based helpers for the projects / credentials / rbac / members /
// admin-audit specs. The seeded demo users share one organisation owned by
// DEMO_USERS.owner; every spec creates (and cleans up) the data it mutates.
// ---------------------------------------------------------------------------

export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "credzo-demo-2026";

/** Seeded accounts and their role in the demo organisation. */
export const DEMO_USERS = {
  /** Platform admin and owner of the demo organisation. */
  owner: process.env.E2E_DEMO_OWNER ?? "dilnoza",
  admin: process.env.E2E_DEMO_ADMIN ?? "aziz",
  member: process.env.E2E_DEMO_MEMBER ?? "malika",
  viewer: process.env.E2E_DEMO_VIEWER ?? "nodira",
} as const;

export type OrgRole = "owner" | "admin" | "member" | "viewer";

/** A signed-in API client and the account behind it. */
export interface Actor {
  api: APIRequestContext;
  id: string;
  username: string;
  email: string;
  password: string;
  /** Active organisation (GET /api/auth/session), null when none. */
  orgId: string | null;
}

export interface CreatedProject {
  id: string;
  name: string;
  description: string;
  organizationId: string | null;
  credentialCount: number;
  currentUserRole: "owner" | "editor" | "viewer";
}

export interface CreatedCredential {
  id: string;
  projectId: string;
  name: string;
  type: string;
  description: string;
  fields: Record<string, string>;
  secretFields: string[];
  environment: "production" | "staging" | "development" | null;
  rotationDays: number | null;
}

type ApiResponse = Awaited<ReturnType<APIRequestContext["get"]>>;

/** Asserts a 2xx response and unwraps `{ success, data }` (auth routes keep top-level fields). */
export async function readData<T>(res: ApiResponse, what: string): Promise<T> {
  const text = await res.text();
  expect(res.ok(), `${what} failed: ${res.status()} ${text.slice(0, 300)}`).toBeTruthy();
  const body = JSON.parse(text) as { data?: T } & T;
  return (body.data ?? body) as T;
}

async function describeActor(api: APIRequestContext, password: string): Promise<Actor> {
  const session = await readData<{
    user: { id: string; username: string; email: string };
    organization: { id: string } | null;
  }>(await api.get("/api/auth/session"), "GET /api/auth/session");
  return {
    api,
    id: session.user.id,
    username: session.user.username,
    email: session.user.email,
    password,
    orgId: session.organization?.id ?? null,
  };
}

type ApiFactory = (headers?: Record<string, string>) => Promise<APIRequestContext>;

async function signInActor(newApi: ApiFactory, username: string, password: string): Promise<Actor> {
  const api = await newApi();
  await apiLogin(api, username, password);
  return describeActor(api, password);
}

async function signUpActor(newApi: ApiFactory): Promise<Actor> {
  // Sign-ups are rate limited per client IP; a fresh IP keeps suites repeatable.
  const api = await newApi(fakeIpHeaders());
  const user = await createUserViaApi(api);
  return describeActor(api, user.password);
}

/** Copies the actor's session (and active-organisation) cookies into the page's browser context. */
export async function signInPage(page: Page, actor: Actor): Promise<void> {
  const { cookies } = await actor.api.storageState();
  await page.context().addCookies(cookies);
}

/** Switches the actor's active organisation (httpOnly cookie on its API context). */
export async function setActiveOrganization(actor: Actor, organizationId: string): Promise<void> {
  await readData(
    await actor.api.post("/api/auth/active-organization", { data: { organizationId } }),
    "POST /api/auth/active-organization"
  );
  actor.orgId = organizationId;
}

/** Adds an existing account (by email) to an organisation with the given role. */
export async function addOrganizationMember(admin: Actor, organizationId: string, email: string, role: OrgRole) {
  return readData<{ type: "member" | "invitation"; member?: { userId: string; role: string } }>(
    await admin.api.post(`/api/organizations/${organizationId}/members`, { data: { email, role } }),
    `invite ${email} as ${role}`
  );
}

/** Best-effort cleanup: removes a member, ignoring "already gone". */
export async function removeOrganizationMember(admin: Actor, organizationId: string, userId: string): Promise<void> {
  const res = await admin.api.delete(`/api/organizations/${organizationId}/members/${userId}`);
  expect([200, 404], `remove member ${userId}: ${res.status()}`).toContain(res.status());
}

/** Fresh account that joins `organizationId` with `role` and makes it its active organisation. */
export async function createOrgMember(
  actors: Actors,
  admin: Actor,
  organizationId: string,
  role: OrgRole
): Promise<Actor> {
  const actor = await actors.signUp();
  await addOrganizationMember(admin, organizationId, actor.email, role);
  await setActiveOrganization(actor, organizationId);
  return actor;
}

/** POST /api/projects. Omit organizationId for the caller's active org; null for personal. */
export async function createProjectApi(
  actor: Actor,
  input: { name?: string; description?: string; organizationId?: string | null } = {}
): Promise<CreatedProject> {
  const data = { name: input.name ?? uniqueName("qa_project"), description: input.description ?? "", ...input };
  return readData<CreatedProject>(await actor.api.post("/api/projects", { data }), `create project ${data.name}`);
}

/** Best-effort cleanup: deletes a project, ignoring "already gone". */
export async function deleteProjectApi(actor: Actor, projectId: string): Promise<void> {
  const res = await actor.api.delete(`/api/projects/${projectId}`);
  expect([200, 404], `delete project ${projectId}: ${res.status()}`).toContain(res.status());
}

/** Random secret that is easy to search for in response bodies. */
export function uniqueSecret(): string {
  return `S3cr3t-${randomBytes(12).toString("hex")}`;
}

/** POST /api/credentials; defaults to a PostgreSQL credential with a unique password. */
export async function createCredentialApi(
  actor: Actor,
  projectId: string,
  input: {
    name?: string;
    type?: string;
    description?: string;
    fields?: Record<string, string>;
    environment?: "production" | "staging" | "development" | null;
    rotationDays?: number;
  } = {}
): Promise<CreatedCredential & { submittedFields: Record<string, string> }> {
  const data = {
    projectId,
    name: input.name ?? uniqueName("qa_cred"),
    type: input.type ?? "postgresql",
    description: input.description ?? "",
    fields: input.fields ?? {
      host: "db.qa.internal",
      port: "5432",
      database: "app",
      username: "app_user",
      password: uniqueSecret(),
    },
    environment: input.environment ?? null,
    ...(input.rotationDays !== undefined && { rotationDays: input.rotationDays }),
  };
  const created = await readData<CreatedCredential>(
    await actor.api.post("/api/credentials", { data }),
    `create credential ${data.name}`
  );
  // The API never echoes secret values back, so keep what was sent.
  return { ...created, submittedFields: data.fields };
}

export interface Actors {
  /** Signs in an existing account through the API. */
  signIn(username: string, password?: string): Promise<Actor>;
  /** Signs up a brand-new account (it owns a fresh personal organisation). */
  signUp(): Promise<Actor>;
}

interface ApiRequestFactory {
  newContext(options: { baseURL?: string; extraHTTPHeaders?: Record<string, string> }): Promise<APIRequestContext>;
}

async function provideDemoActor(
  request: ApiRequestFactory,
  baseURL: string | undefined,
  username: string,
  provide: (actor: Actor) => Promise<void>
): Promise<void> {
  const api = await request.newContext({ baseURL, extraHTTPHeaders: originHeaders(baseURL) });
  await provide(await signInActor(async () => api, username, DEMO_PASSWORD));
  await api.dispose();
}

/**
 * `test` plus signed-in API actors. Seeded demo users are worker-scoped (one
 * sign-in per worker); `actors` creates per-test accounts and disposes them.
 */
export const roleTest = test.extend<
  { actors: Actors },
  { demoOwner: Actor; demoAdmin: Actor; demoMember: Actor; demoViewer: Actor }
>({
  actors: async ({ playwright, baseURL }, provide) => {
    const contexts: APIRequestContext[] = [];
    const newApi: ApiFactory = async (headers = {}) => {
      const api = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { ...originHeaders(baseURL), ...headers },
      });
      contexts.push(api);
      return api;
    };
    const signedUp: Actor[] = [];
    await provide({
      signIn: (username, password = DEMO_PASSWORD) => signInActor(newApi, username, password),
      signUp: async () => {
        const actor = await signUpActor(newApi);
        signedUp.push(actor);
        return actor;
      },
    });
    // Fresh accounts can't be deleted (they own an organisation), but their projects can:
    // platform admins see every project, so leftovers would clutter the demo vault.
    for (const actor of signedUp) {
      const res = await actor.api.get("/api/projects");
      if (!res.ok()) continue;
      const { data } = (await res.json()) as { data: { id: string; ownerId: string }[] };
      for (const project of data.filter((item) => item.ownerId === actor.id)) {
        await deleteProjectApi(actor, project.id);
      }
    }
    await Promise.all(contexts.map((api) => api.dispose()));
  },
  demoOwner: [
    ({ playwright }, provide, { project }) =>
      provideDemoActor(playwright.request, project.use.baseURL, DEMO_USERS.owner, provide),
    { scope: "worker" },
  ],
  demoAdmin: [
    ({ playwright }, provide, { project }) =>
      provideDemoActor(playwright.request, project.use.baseURL, DEMO_USERS.admin, provide),
    { scope: "worker" },
  ],
  demoMember: [
    ({ playwright }, provide, { project }) =>
      provideDemoActor(playwright.request, project.use.baseURL, DEMO_USERS.member, provide),
    { scope: "worker" },
  ],
  demoViewer: [
    ({ playwright }, provide, { project }) =>
      provideDemoActor(playwright.request, project.use.baseURL, DEMO_USERS.viewer, provide),
    { scope: "worker" },
  ],
});
