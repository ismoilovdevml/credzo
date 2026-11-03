import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import {
  createCredentialApi,
  createProjectApi,
  deleteProjectApi,
  expect,
  readData,
  roleTest as test,
  signInPage,
  uniqueName,
  type CreatedProject,
} from "./fixtures";

/** Admin overview, audit log and the mobile shell, as the demo organisation owner (platform admin). */

const CSV_HEADER =
  "Timestamp (UTC),Actor,Actor ID,Action,Action code,Resource type,Resource,Resource ID,IP address,User agent,Details";

async function auditActions(page: Page): Promise<string[]> {
  return page
    .getByTestId("audit-row")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-action") ?? ""));
}

test.describe("admin overview", () => {
  test("shows numeric stat cards, a range switch and the activity chart", async ({ page, demoOwner }) => {
    await signInPage(page, demoOwner);
    await page.goto("/dashboard/admin");

    await expect(page.getByRole("heading", { level: 1, name: "Admin overview" })).toBeVisible();
    for (const id of ["users", "projects", "credentials", "events", "failed"]) {
      await expect(page.getByTestId(`admin-stat-${id}`)).toHaveText(/\d/);
    }
    // At least the five seeded accounts exist.
    const usersText = (await page.getByTestId("admin-stat-users").innerText()).replace(/,/g, "");
    const users = Number(usersText.match(/\d+/)?.[0]);
    expect(users).toBeGreaterThanOrEqual(5);
    await expect(page.getByTestId("activity-chart")).toBeVisible();

    const range = page.getByTestId("admin-range");
    await expect(range.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");

    const statsRequest = page.waitForResponse((res) => res.url().includes("/api/admin/stats?range=24h"));
    await range.getByRole("button", { name: "24 h" }).click();
    expect((await statsRequest).status()).toBe(200);
    await expect(page).toHaveURL(/[?&]range=24h/);
    await expect(range.getByRole("button", { name: "24 h" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("admin-stat-users")).toContainText("active in 24 h");

    await range.getByRole("button", { name: "30 days" }).click();
    await expect(page).toHaveURL(/[?&]range=30d/);
    await expect(page.getByTestId("admin-stat-users")).toContainText("active in 30 days");
    await expect(page.getByTestId("activity-chart")).toBeVisible();

    // The range survives a reload.
    await page.reload();
    await expect(page.getByTestId("admin-range").getByRole("button", { name: "30 days" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});

test.describe("audit log", () => {
  let project: CreatedProject;
  let credential: Awaited<ReturnType<typeof createCredentialApi>>;

  test.beforeEach(async ({ demoOwner }) => {
    project = await createProjectApi(demoOwner, { name: uniqueName("Audit QA") });
    credential = await createCredentialApi(demoOwner, project.id, { name: uniqueName("audit_cred") });
    // Guarantees at least one "accessed" event that names this credential.
    await readData(await demoOwner.api.post(`/api/credentials/${credential.id}/reveal`), "reveal");
  });

  test.afterEach(async ({ demoOwner }) => {
    await deleteProjectApi(demoOwner, project.id);
  });

  test("filters by action from the URL", async ({ page, demoOwner }) => {
    await signInPage(page, demoOwner);
    await page.goto("/dashboard/audit?action=accessed");

    await expect(page.getByTestId("audit-filter-action")).toHaveValue("accessed");
    await expect(page.getByTestId("audit-row").first()).toBeVisible();
    const actions = await auditActions(page);
    expect(actions.length).toBeGreaterThan(0);
    expect(new Set(actions)).toEqual(new Set(["accessed"]));
    await expect(page.getByTestId("audit-list")).toContainText(credential.name);
  });

  test("filters by action from the dropdown and clears filters", async ({ page, demoOwner }) => {
    await signInPage(page, demoOwner);
    await page.goto("/dashboard/audit");
    await expect(page.getByTestId("audit-row").first()).toBeVisible();

    await page.getByTestId("audit-filter-action").selectOption("created");
    await expect(page).toHaveURL(/[?&]action=created/);
    await expect.poll(async () => new Set(await auditActions(page))).toEqual(new Set(["created"]));

    await page.getByTestId("audit-clear-filters").click();
    await expect(page).not.toHaveURL(/action=/);
    await expect(page.getByTestId("audit-filter-action")).toHaveValue("");
  });

  test("searches events by credential name", async ({ page, demoOwner }) => {
    await signInPage(page, demoOwner);
    await page.goto("/dashboard/audit");
    await expect(page.getByTestId("audit-row").first()).toBeVisible();

    await page.getByTestId("audit-search").fill(credential.name);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${credential.name}`));
    const rows = page.getByTestId("audit-row");
    // Created + accessed for this credential only.
    await expect.poll(async () => (await auditActions(page)).sort()).toEqual(["accessed", "created"]);
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) await expect(row).toContainText(credential.name);

    await page.getByTestId("audit-search").fill(uniqueName("no_such_event"));
    await expect(page.getByTestId("audit-empty")).toBeVisible();
  });

  test("exports the shown events as CSV with a header row", async ({ page, demoOwner }) => {
    await signInPage(page, demoOwner);
    await page.goto(`/dashboard/audit?search=${encodeURIComponent(credential.name)}`);
    await expect(page.getByTestId("audit-row")).toHaveCount(2);

    const downloadEvent = page.waitForEvent("download");
    await page.getByTestId("audit-export-csv").click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/^credzo-audit-.+-\d{4}-\d{2}-\d{2}\.csv$/);

    // A leading byte-order mark lets Excel detect UTF-8.
    const csv = (await readFile(await download.path(), "utf8")).replace(/^\uFEFF/, "");
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines).toHaveLength(3);
    expect(lines.slice(1).every((line) => line.includes(credential.id))).toBe(true);
    expect(csv).not.toContain(credential.submittedFields.password);
  });
});

test.describe("mobile shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("sidebar becomes a drawer that navigates and closes @mobile", async ({ page, demoOwner }) => {
    await signInPage(page, demoOwner);
    await page.goto("/dashboard");

    const mainNav = page.getByRole("navigation", { name: "Main" });
    await expect(mainNav).toBeHidden();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toHaveCount(0);

    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await menuButton.click();
    await expect(drawer).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await drawer.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Projects/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/projects$/);
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

    // Escape and the close button also dismiss it.
    await menuButton.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await menuButton.click();
    await drawer.getByRole("button", { name: "Close navigation" }).click();
    await expect(drawer).toBeHidden();
  });

  test("key pages have no horizontal scroll at 375px @mobile", async ({ page, demoOwner }) => {
    const project = await createProjectApi(demoOwner, {
      name: uniqueName("Mobile layout project with a fairly long name"),
      description: "Checks that long names and tables do not widen the page on phones.",
    });
    try {
      const credential = await createCredentialApi(demoOwner, project.id, {
        name: uniqueName("mobile-credential-with-a-long-name"),
        environment: "production",
        fields: {
          host: "a-very-long-hostname.eu-central-1.rds.amazonaws.example.com",
          port: "5432",
          database: "orders_reporting_replica",
          username: "reporting_readonly_user",
          password: "x".repeat(40),
        },
      });
      await signInPage(page, demoOwner);

      const pages: [string, string][] = [
        ["/dashboard", "overview-greeting"],
        ["/dashboard/projects", "projects-grid"],
        [`/dashboard/projects/${project.id}`, "credential-row"],
        [`/dashboard/projects/${project.id}/credentials/${credential.id}`, "credential-name"],
      ];
      for (const [path, readyTestId] of pages) {
        await page.goto(path);
        await expect(page.getByTestId(readyTestId).first()).toBeVisible();
        // clientWidth is the layout viewport; mobile emulation widens innerWidth to fit overflowing content.
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        expect(overflow.viewport).toBe(375);
        expect.soft(overflow.scrollWidth, `${path} scrolls horizontally`).toBeLessThanOrEqual(overflow.viewport);
      }
    } finally {
      await deleteProjectApi(demoOwner, project.id);
    }
  });
});
