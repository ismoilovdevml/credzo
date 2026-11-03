import path from "node:path";

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
export const ADMIN_USER = process.env.E2E_ADMIN_USER ?? "e2e_admin";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-admin-password-123";
export const ADMIN_STORAGE_STATE = path.join(__dirname, ".auth", "admin.json");

/**
 * Mutating API calls must look same-origin to the CSRF guard.
 * Playwright's request context sends no Origin header by default.
 */
export function originHeaders(baseURL: string = BASE_URL): Record<string, string> {
  return { Origin: new URL(baseURL).origin };
}
