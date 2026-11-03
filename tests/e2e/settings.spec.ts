import { readFile } from "node:fs/promises";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  test as base,
  expect,
  apiLogin,
  createProjectViaApi,
  fakeIpHeaders,
  newIsolatedContext,
  originHeaders,
  signupUser,
  uniqueName,
  waitForHydration,
} from "./fixtures";

// Every test gets its own client IP: sign-ups are rate-limited per IP.
const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide(fakeIpHeaders());
  },
});

async function openSettings(page: Page) {
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await waitForHydration(page.getByTestId("profile-save"));
}

async function createPostgresCredential(request: APIRequestContext, projectId: string, name: string, password: string) {
  const res = await request.post("/api/credentials", {
    headers: originHeaders(),
    data: {
      projectId,
      name,
      type: "postgresql",
      fields: { host: "db.internal", port: "5432", database: "app", username: "app", password },
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data.id as string;
}

async function projectNames(request: APIRequestContext): Promise<string[]> {
  const res = await request.get("/api/projects");
  expect(res.status()).toBe(200);
  return ((await res.json()).data as { name: string }[]).map((project) => project.name);
}

test.describe("settings", () => {
  test("profile edits persist after a reload", async ({ page }) => {
    await signupUser(page.request, { firstName: "Before", lastName: "Edit" });
    await openSettings(page);

    await expect(page.getByTestId("profile-first-name")).toHaveValue("Before");
    // No time zone stored yet: the browser's is suggested and Save stays available to keep it.
    await expect(page.getByText("Detected from your browser — save to keep it.")).toBeVisible();

    await page.getByTestId("profile-first-name").fill("Gulnora");
    await page.getByTestId("profile-last-name").fill("Rashidova");
    await page.getByTestId("profile-job-title").fill("Platform engineer");
    await page.getByTestId("profile-timezone").selectOption("Asia/Tashkent");
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await page.getByTestId("profile-save").click();

    await expect(page.getByText("Profile saved")).toBeVisible();
    await expect(page.getByTestId("profile-save")).toBeDisabled();
    // The shell picks up the new name without a reload.
    await expect(page.getByRole("button", { name: /account menu/i })).toContainText("Gulnora Rashidova");

    await page.reload();
    await waitForHydration(page.getByTestId("profile-save"));
    await expect(page.getByTestId("profile-first-name")).toHaveValue("Gulnora");
    await expect(page.getByTestId("profile-last-name")).toHaveValue("Rashidova");
    await expect(page.getByTestId("profile-job-title")).toHaveValue("Platform engineer");
    await expect(page.getByTestId("profile-timezone")).toHaveValue("Asia/Tashkent");

    const profile = (await (await page.request.get("/api/user-profile")).json()).data;
    expect(profile).toMatchObject({
      firstName: "Gulnora",
      lastName: "Rashidova",
      jobTitle: "Platform engineer",
      timezone: "Asia/Tashkent",
    });
  });

  test("change password: the old one stops working and the new one works", async ({ page, request }) => {
    const user = await signupUser(page.request);
    const newPassword = `new-${uniqueName("pw")}`;
    await openSettings(page);

    await page.getByTestId("change-password-button").click();
    const dialog = page.getByRole("dialog", { name: "Change password" });
    await expect(dialog).toBeVisible();

    // Client-side checks first.
    await page.getByTestId("current-password").fill(user.password);
    await page.getByTestId("new-password").fill("short");
    await page.getByTestId("change-password-submit").click();
    await expect(dialog.getByText("Use at least 10 characters")).toBeVisible();

    // Wrong current password is rejected by the server.
    await page.getByTestId("current-password").fill("not-my-current-password");
    await page.getByTestId("new-password").fill(newPassword);
    await page.getByTestId("confirm-password").fill(newPassword);
    await page.getByTestId("change-password-submit").click();
    await expect(dialog.locator("[id$='-error']").first()).toBeVisible();
    await expect(dialog).toBeVisible();

    await page.getByTestId("current-password").fill(user.password);
    await page.getByTestId("change-password-submit").click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/^Password changed\./)).toBeVisible();

    // This browser stays signed in.
    expect((await page.request.get("/api/auth/session")).status()).toBe(200);

    const oldLogin = await request.post("/api/auth/login", {
      headers: originHeaders(),
      data: { username: user.username, password: user.password },
    });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await request.post("/api/auth/login", {
      headers: originHeaders(),
      data: { username: user.username, password: newPassword },
    });
    expect(newLogin.status()).toBe(200);
  });

  test("sessions list marks this device and 'Sign out all others' ends the other session", async ({
    page,
    browser,
  }, testInfo) => {
    const user = await signupUser(page.request);
    const other = await newIsolatedContext(browser, testInfo);
    try {
      await apiLogin(other.request, user.username, user.password);
      expect((await other.request.get("/api/auth/session")).status()).toBe(200);

      await openSettings(page);
      const rows = page.getByTestId("session-row");
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: "This device" })).toHaveCount(1);
      await expect(rows.first()).toContainText("This device");
      await expect(rows.filter({ hasNotText: "This device" }).getByTestId("sign-out-session")).toBeVisible();

      await page.getByTestId("sign-out-others").click();
      await expect(page.getByText("Signed out 1 other session")).toBeVisible();
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("This device");
      await expect(page.getByTestId("sign-out-others")).toHaveCount(0);

      expect((await other.request.get("/api/auth/session")).status()).toBe(401);
      expect((await page.request.get("/api/auth/session")).status()).toBe(200);

      // The revoked browser is sent back to sign-in.
      const otherPage = await other.newPage();
      await otherPage.goto("/dashboard");
      await expect(otherPage).toHaveURL(/\/login/);

      await page.reload();
      await expect(page.getByTestId("session-row")).toHaveCount(1);
    } finally {
      await other.close();
    }
  });

  test("theme buttons switch between light, dark and the system scheme", async ({ page }) => {
    await signupUser(page.request);
    await page.emulateMedia({ colorScheme: "light" });
    await openSettings(page);
    const html = page.locator("html");

    await page.getByTestId("theme-dark").click();
    await expect(page.getByTestId("theme-dark")).toHaveAttribute("aria-checked", "true");
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");

    await page.getByTestId("theme-light").click();
    await expect(page.getByTestId("theme-light")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("theme-dark")).toHaveAttribute("aria-checked", "false");
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);

    await page.getByTestId("theme-system").click();
    await expect(page.getByTestId("theme-system")).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("system");
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
  });

  test("encrypted export downloads a .json that another user can import", async ({ page, browser }, testInfo) => {
    await signupUser(page.request);
    const projectName = uniqueName("Backup project");
    const secret = `s3cret-${uniqueName("pg")}`;
    const projectId = await createProjectViaApi(page.request, projectName);
    await createPostgresCredential(page.request, projectId, "payments-db", secret);
    const passphrase = "export-passphrase-2026";

    await openSettings(page);
    await page.getByTestId("export-button").click();
    await page.getByTestId("export-passphrase").fill(passphrase);
    await page.getByTestId("export-passphrase-confirm").fill(passphrase);
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-submit").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^credzo-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const filePath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(filePath);
    await expect(page.getByText("Backup downloaded: 1 project, 1 credential")).toBeVisible();

    const text = await readFile(filePath, "utf8");
    const backup = JSON.parse(text);
    expect(backup).toMatchObject({ format: "credzo-backup", version: 1 });
    expect(typeof backup.data).toBe("string");
    expect(text, "the backup must be encrypted").not.toContain(secret);
    expect(text).not.toContain(projectName);

    // Import into a different, brand-new account.
    const importer = await newIsolatedContext(browser, testInfo);
    try {
      const importerPage = await importer.newPage();
      await signupUser(importer.request);
      expect(await projectNames(importer.request)).not.toContain(projectName);

      await openSettings(importerPage);
      await importerPage.getByTestId("import-file").setInputFiles(filePath);
      const dialog = importerPage.getByRole("dialog", { name: "Import backup" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(download.suggestedFilename());

      await importerPage.getByTestId("import-passphrase").fill("wrong-passphrase-123");
      await importerPage.getByTestId("import-submit").click();
      await expect(dialog.getByText("Wrong passphrase, or the file is damaged.")).toBeVisible();
      expect(await projectNames(importer.request)).not.toContain(projectName);

      await importerPage.getByTestId("import-passphrase").fill(passphrase);
      await importerPage.getByTestId("import-submit").click();
      await expect(dialog).toBeHidden();
      await expect(importerPage.getByText("Imported 1 project and 1 credential")).toBeVisible();

      const projects = (await (await importer.request.get("/api/projects")).json()).data as {
        id: string;
        name: string;
        credentialCount: number;
        currentUserRole: string;
      }[];
      const imported = projects.find((project) => project.name === projectName);
      expect(imported, "imported project is listed for the importer").toBeTruthy();
      expect(imported).toMatchObject({ credentialCount: 1, currentUserRole: "owner" });

      const credentials = (await (await importer.request.get(`/api/credentials?projectId=${imported!.id}`)).json())
        .data as { id: string; name: string }[];
      expect(credentials.map((credential) => credential.name)).toEqual(["payments-db"]);
      const reveal = await importer.request.post(`/api/credentials/${credentials[0].id}/reveal`, {
        headers: originHeaders(),
      });
      expect((await reveal.json()).data.fields.password).toBe(secret);
    } finally {
      await importer.close();
    }
  });

  test("delete all data with the password removes the user's personal projects", async ({ page }) => {
    const user = await signupUser(page.request);
    const projectId = await createProjectViaApi(page.request, uniqueName("Doomed one"));
    await createProjectViaApi(page.request, uniqueName("Doomed two"));
    await createPostgresCredential(page.request, projectId, "doomed-db", "doomed-secret-value");
    expect(await projectNames(page.request)).toHaveLength(2);

    await openSettings(page);
    await page.getByTestId("delete-data-button").click();
    const dialog = page.getByRole("alertdialog", { name: "Delete all your data?" });
    await expect(dialog).toBeVisible();
    const submit = page.getByTestId("delete-data-submit");
    await expect(submit).toBeDisabled();

    await page.getByTestId("delete-data-password").fill("not-the-password");
    await expect(submit).toBeDisabled();
    await page.getByTestId("delete-data-confirm").fill("DELETE");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(dialog.getByText("Password is incorrect")).toBeVisible();
    expect(await projectNames(page.request)).toHaveLength(2);

    await page.getByTestId("delete-data-password").fill(user.password);
    await submit.click();
    await expect(page.getByText("Deleted 2 projects and 1 credential")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await projectNames(page.request)).toEqual([]);

    // The account itself survives.
    expect((await page.request.get("/api/auth/session")).status()).toBe(200);
  });
});
