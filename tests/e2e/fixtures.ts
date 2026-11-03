import { randomBytes } from "node:crypto";
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
  await page.getByLabel(/email or username/i).fill(username);
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
