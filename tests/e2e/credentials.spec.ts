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
  type Actor,
  type CreatedCredential,
  type CreatedProject,
} from "./fixtures";

/**
 * Runs as the demo organisation owner against a throw-away project per test,
 * created through the API and deleted afterwards.
 */

interface AuditLog {
  action: string;
  userId: string;
  resourceId?: string;
  resourceType: string;
}

let project: CreatedProject;

test.beforeEach(async ({ demoOwner }) => {
  project = await createProjectApi(demoOwner, { name: uniqueName("Credentials QA") });
});

test.afterEach(async ({ demoOwner }) => {
  await deleteProjectApi(demoOwner, project.id);
});

function credentialUrl(credential: { id: string; projectId: string }) {
  return `/dashboard/projects/${credential.projectId}/credentials/${credential.id}`;
}

/** "accessed" audit events for one credential, newest first. */
async function accessedEvents(owner: Actor, credentialId: string): Promise<AuditLog[]> {
  const res = await owner.api.get(
    `/api/organizations/${owner.orgId}/audit?action=accessed&resourceId=${encodeURIComponent(credentialId)}&limit=100`
  );
  const { logs } = await readData<{ logs: AuditLog[] }>(res, "GET audit");
  // Also filter here: builds without the resourceId query filter return every "accessed" event.
  return logs.filter((log) => log.resourceId === credentialId);
}

async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe("credentials", () => {
  test("adds a PostgreSQL credential through the form; detail masks the secret", async ({ page, demoOwner }) => {
    const name = uniqueName("Primary DB");
    const host = `pg-${uniqueName("h").toLowerCase().replace(/_/g, "-")}.internal`;
    await signInPage(page, demoOwner);

    await page.goto(`/dashboard/projects/${project.id}`);
    await page.getByTestId("add-credential-button").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${project.id}/credentials/new$`));
    await expect(page.getByTestId("save-credential")).toBeDisabled();

    await page.getByTestId("service-search").fill("postgre");
    await page.getByTestId("service-option-postgresql").click();
    await expect(page.getByTestId("service-option-postgresql")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("credential-name-input").fill(name);
    const production = page.getByRole("group", { name: "Environment" }).getByRole("button", { name: "Production" });
    await production.click();
    await expect(production).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("field-host").fill(host);
    await page.getByTestId("field-port").fill("5432");
    await page.getByTestId("field-database").fill("orders");
    await page.getByTestId("field-username").fill("orders_app");

    const passwordInput = page.getByTestId("field-password");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await page.getByTestId("generate-password").click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    const password = await passwordInput.inputValue();
    expect(password).toHaveLength(32);

    await page.getByTestId("rotation-select").selectOption("90");
    await page.getByTestId("save-credential").click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${project.id}/credentials/cred_[^/]+$`));
    const credentialId = page.url().split("/").pop() as string;
    await expect(page.getByTestId("credential-name")).toHaveText(name);
    await expect(page.getByTestId("field-host")).toContainText(host);
    await expect(page.getByTestId("field-username")).toContainText("orders_app");
    await expect(page.getByTestId("field-password")).toContainText("Password hidden");
    await expect(page.getByTestId("field-password")).not.toContainText(password);
    await expect(page.getByTestId("rotation-status")).toBeVisible();
    expect(await page.content()).not.toContain(password);

    const saved = await readData<CreatedCredential & { currentUserRole: string }>(
      await demoOwner.api.get(`/api/credentials/${credentialId}`),
      "GET credential"
    );
    expect(saved).toMatchObject({ type: "postgresql", environment: "production", rotationDays: 90, name });
    expect(saved.fields).toMatchObject({ host, port: "5432", database: "orders", username: "orders_app" });
    expect(saved.secretFields).toContain("password");

    // List and detail endpoints never carry secret values.
    for (const path of [
      "/api/credentials",
      `/api/credentials?projectId=${project.id}`,
      `/api/credentials/${credentialId}`,
      `/api/projects/${project.id}`,
      "/api/projects",
    ]) {
      const res = await demoOwner.api.get(path);
      expect(res.status(), path).toBe(200);
      expect(await res.text(), `${path} leaks the secret`).not.toContain(password);
    }

    // Only the audited reveal endpoint returns it.
    const revealed = await readData<{ fields: Record<string, string> }>(
      await demoOwner.api.post(`/api/credentials/${credentialId}/reveal`),
      "reveal"
    );
    expect(revealed.fields.password).toBe(password);
  });

  test("reveal shows the exact secret and records an 'accessed' audit event", async ({ page, demoOwner }) => {
    const credential = await createCredentialApi(demoOwner, project.id, { environment: "production" });
    expect(await accessedEvents(demoOwner, credential.id)).toHaveLength(0);
    await signInPage(page, demoOwner);

    await page.goto(credentialUrl(credential));
    const passwordField = page.getByTestId("field-password");
    await expect(passwordField).toContainText("Password hidden");

    const revealRequest = page.waitForResponse(
      (res) => res.url().endsWith(`/api/credentials/${credential.id}/reveal`) && res.request().method() === "POST"
    );
    await page.getByTestId("reveal-password").click();
    expect((await revealRequest).status()).toBe(200);

    await expect(passwordField.locator("dd")).toHaveText(credential.submittedFields.password);
    await expect(page.getByTestId("reveal-password")).toHaveAttribute("aria-pressed", "true");

    await expect.poll(async () => (await accessedEvents(demoOwner, credential.id)).length).toBe(1);
    const [event] = await accessedEvents(demoOwner, credential.id);
    expect(event).toMatchObject({ action: "accessed", userId: demoOwner.id, resourceId: credential.id });

    // Hiding re-masks without another reveal call.
    await page.getByTestId("reveal-password").click();
    await expect(passwordField).toContainText("Password hidden");
    await expect(passwordField).not.toContainText(credential.submittedFields.password);
  });

  test("copies the secret to the clipboard from the detail page and the project table", async ({
    page,
    context,
    baseURL,
    demoOwner,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
    const credential = await createCredentialApi(demoOwner, project.id, { environment: "staging" });
    await signInPage(page, demoOwner);

    await page.goto(credentialUrl(credential));
    await page.getByTestId("copy-password").click();
    await expect(page.getByText(/Copied\. Clipboard clears in 30s/).first()).toBeVisible();
    expect(await readClipboard(page)).toBe(credential.submittedFields.password);
    // Copying must not reveal the value on screen.
    await expect(page.getByTestId("field-password")).not.toContainText(credential.submittedFields.password);

    await page.evaluate(() => navigator.clipboard.writeText("placeholder"));
    await page.goto(`/dashboard/projects/${project.id}`);
    const row = page.getByTestId("credential-row").filter({ hasText: credential.name });
    await row.getByTestId("copy-secret").click();
    await expect.poll(() => readClipboard(page)).toBe(credential.submittedFields.password);
  });

  test("connection string masks the password until revealed and copies the full URI", async ({
    page,
    context,
    baseURL,
    demoOwner,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
    const credential = await createCredentialApi(demoOwner, project.id);
    const { host, port, database, username, password } = credential.submittedFields;
    const fullUri = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    await signInPage(page, demoOwner);

    await page.goto(credentialUrl(credential));
    const connection = page.getByTestId("connection-string");
    await expect(connection).toHaveText(`postgresql://${username}:••••@${host}:${port}/${database}`);

    await page.getByTestId("copy-connection-string").click();
    await expect.poll(() => readClipboard(page)).toBe(fullUri);
    await expect(connection).not.toContainText(password);

    await page.getByTestId("reveal-password").click();
    await expect(connection).toHaveText(fullUri);
  });

  test("editing only the notes keeps the stored secret unchanged", async ({ page, demoOwner }) => {
    const credential = await createCredentialApi(demoOwner, project.id, {
      environment: "development",
      description: "original notes",
    });
    await signInPage(page, demoOwner);

    await page.goto(credentialUrl(credential));
    await page.getByTestId("edit-credential").click();
    await expect(page).toHaveURL(new RegExp(`${credential.id}/edit$`));

    const notes = page.getByLabel("Notes");
    await expect(notes).toHaveValue("original notes");
    await expect(page.getByTestId("save-credential")).toBeDisabled();
    await notes.fill("rotated by the platform team");

    const patch = page.waitForRequest(
      (req) => req.url().endsWith(`/api/credentials/${credential.id}`) && req.method() === "PATCH"
    );
    await page.getByTestId("save-credential").click();
    const body = (await patch).postDataJSON() as Record<string, unknown>;
    expect(body).toEqual({ description: "rotated by the platform team" });

    await expect(page).toHaveURL(new RegExp(`${credential.id}$`));
    await expect(page.getByTestId("credential-description")).toHaveText("rotated by the platform team");

    const revealed = await readData<{ fields: Record<string, string> }>(
      await demoOwner.api.post(`/api/credentials/${credential.id}/reveal`),
      "reveal"
    );
    expect(revealed.fields.password).toBe(credential.submittedFields.password);
    const saved = await readData<CreatedCredential>(
      await demoOwner.api.get(`/api/credentials/${credential.id}`),
      "GET credential"
    );
    expect(saved).toMatchObject({ environment: "development", name: credential.name });
    expect(saved.fields).toEqual(credential.fields);
    expect(saved.fields).not.toHaveProperty("password");
  });

  test("environment tabs on the project page count and filter credentials", async ({ page, demoOwner }) => {
    const prodA = await createCredentialApi(demoOwner, project.id, { environment: "production" });
    const prodB = await createCredentialApi(demoOwner, project.id, { environment: "production" });
    await createCredentialApi(demoOwner, project.id, { environment: "staging" });
    await createCredentialApi(demoOwner, project.id, { environment: null });
    await signInPage(page, demoOwner);

    await page.goto(`/dashboard/projects/${project.id}`);
    await expect(page.getByTestId("credential-row")).toHaveCount(4);
    await expect(page.getByTestId("env-tab-all")).toHaveText(/All\s*4/);
    await expect(page.getByTestId("env-tab-production")).toHaveText(/Production\s*2/);
    await expect(page.getByTestId("env-tab-staging")).toHaveText(/Staging\s*1/);
    await expect(page.getByTestId("env-tab-development")).toHaveText(/Development\s*0/);

    await page.getByTestId("env-tab-production").click();
    await expect(page.getByTestId("env-tab-production")).toHaveAttribute("aria-pressed", "true");
    const rows = page.getByTestId("credential-row");
    await expect(rows).toHaveCount(2);
    const ids = await rows.evaluateAll((elements) => elements.map((el) => el.getAttribute("data-credential-id")));
    expect(ids.sort()).toEqual([prodA.id, prodB.id].sort());

    await page.getByTestId("env-tab-development").click();
    await expect(rows).toHaveCount(0);
    await expect(page.getByText("No credentials in this environment yet.")).toBeVisible();
  });

  test("deletes a credential from its detail page after confirming", async ({ page, demoOwner }) => {
    const credential = await createCredentialApi(demoOwner, project.id);
    await signInPage(page, demoOwner);

    await page.goto(credentialUrl(credential));
    await page.getByTestId("delete-credential").click();
    const confirm = page.getByRole("alertdialog", { name: "Delete credential?" });
    await expect(confirm).toContainText(credential.name);
    await confirm.getByRole("button", { name: "Delete credential" }).click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${project.id}$`));
    await expect(page.getByTestId("credential-row")).toHaveCount(0);
    expect((await demoOwner.api.get(`/api/credentials/${credential.id}`)).status()).toBe(404);
  });

  test("deletes a credential from the project table", async ({ page, demoOwner }) => {
    const keep = await createCredentialApi(demoOwner, project.id);
    const doomed = await createCredentialApi(demoOwner, project.id);
    await signInPage(page, demoOwner);

    await page.goto(`/dashboard/projects/${project.id}`);
    await page.getByTestId("credential-row").filter({ hasText: doomed.name }).getByTestId("delete-credential").click();
    await page.getByRole("alertdialog", { name: "Delete credential?" }).getByRole("button", { name: "Delete credential" }).click();

    await expect(page.getByTestId("credential-row")).toHaveCount(1);
    await expect(page.getByTestId("credential-row")).toHaveAttribute("data-credential-id", keep.id);
    expect((await demoOwner.api.get(`/api/credentials/${doomed.id}`)).status()).toBe(404);
  });
});
