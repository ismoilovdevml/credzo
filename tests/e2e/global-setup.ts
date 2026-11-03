import { mkdir } from "node:fs/promises";
import path from "node:path";
import { request, type FullConfig } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_STORAGE_STATE, ADMIN_USER, originHeaders } from "./env";

/**
 * Ensures the e2e admin account exists and stores its signed-in state
 * at tests/e2e/.auth/admin.json for the `adminPage` fixture.
 *
 * On a fresh DATA_DIR the first signup becomes the platform admin.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("globalSetup: no baseURL configured");

  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: originHeaders(baseURL) });
  try {
    const signup = await ctx.post("/api/auth/signup", {
      data: {
        username: ADMIN_USER,
        email: `${ADMIN_USER}@example.com`,
        password: ADMIN_PASSWORD,
        firstName: "E2E",
        lastName: "Admin",
      },
    });

    if (!signup.ok()) {
      // Already exists, or signup is closed because users exist: sign in instead.
      const signupError = await signup.text();
      const login = await ctx.post("/api/auth/login", {
        data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
      });
      if (!login.ok()) {
        throw new Error(
          `globalSetup: cannot create or sign in as "${ADMIN_USER}".\n` +
            `  signup ${signup.status()}: ${signupError}\n` +
            `  login  ${login.status()}: ${await login.text()}\n` +
            "  Use a fresh DATA_DIR or set E2E_ADMIN_USER / E2E_ADMIN_PASSWORD.",
        );
      }
    }

    await mkdir(path.dirname(ADMIN_STORAGE_STATE), { recursive: true });
    await ctx.storageState({ path: ADMIN_STORAGE_STATE });
  } finally {
    await ctx.dispose();
  }
}
