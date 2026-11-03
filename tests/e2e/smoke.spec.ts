import { test, expect } from "./fixtures";

test.describe("smoke", () => {
  test("landing page renders its headline @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/credzo/i);
  });

  test("health endpoint reports ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status ?? body.data?.status).toBe("ok");
  });
});
