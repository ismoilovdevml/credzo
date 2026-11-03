import {
  createCredentialApi,
  createOrgMember,
  createProjectApi,
  deleteProjectApi,
  expect,
  readData,
  removeOrganizationMember,
  roleTest as test,
  signInPage,
  uniqueName,
  type CreatedCredential,
  type CreatedProject,
} from "./fixtures";

/**
 * Role enforcement in the UI and the API. The demo organisation owner creates a
 * throw-away organisation project (with one credential) per test; the seeded
 * viewer and member act on it and it is deleted afterwards.
 */

let project: CreatedProject;
let credential: CreatedCredential & { submittedFields: Record<string, string> };

test.beforeEach(async ({ demoOwner }) => {
  project = await createProjectApi(demoOwner, { name: uniqueName("RBAC QA"), organizationId: demoOwner.orgId });
  credential = await createCredentialApi(demoOwner, project.id, { environment: "production" });
});

test.afterEach(async ({ demoOwner }) => {
  await deleteProjectApi(demoOwner, project.id);
});

test.describe("organisation viewer", () => {
  test("sees no add/edit/delete controls but can reveal secrets", async ({ page, demoViewer }) => {
    expect(demoViewer.orgId, "viewer must be active in the demo organisation").toBe(project.organizationId);
    await signInPage(page, demoViewer);

    await page.goto(`/dashboard/projects/${project.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(project.name);
    await expect(page.getByText(/^Your role:\s*Viewer$/)).toBeVisible();
    const row = page.getByTestId("credential-row").filter({ hasText: credential.name });
    await expect(row).toBeVisible();
    await expect(page.getByTestId("add-credential-button")).toHaveCount(0);
    await expect(page.getByTestId("edit-project")).toHaveCount(0);
    await expect(page.getByTestId("delete-project")).toHaveCount(0);
    await expect(row.getByTestId("delete-credential")).toHaveCount(0);
    await expect(row.getByRole("link", { name: `Edit ${credential.name}` })).toHaveCount(0);

    await row.getByRole("link", { name: `Open ${credential.name}` }).click();
    await expect(page.getByTestId("credential-name")).toHaveText(credential.name);
    await expect(page.getByTestId("edit-credential")).toHaveCount(0);
    await expect(page.getByTestId("delete-credential")).toHaveCount(0);
    await expect(page.getByTestId("mark-rotated")).toHaveCount(0);

    await page.getByTestId("reveal-password").click();
    await expect(page.getByTestId("field-password").locator("dd")).toHaveText(credential.submittedFields.password);
  });

  test("is shown a read-only notice on the new and edit credential screens", async ({ page, demoViewer }) => {
    await signInPage(page, demoViewer);

    await page.goto(`/dashboard/projects/${project.id}/credentials/new`);
    await expect(page.getByText(/Viewers can open and reveal credentials in this project/)).toBeVisible();
    await expect(page.getByTestId("save-credential")).toHaveCount(0);

    await page.goto(`/dashboard/projects/${project.id}/credentials/${credential.id}/edit`);
    await expect(page.getByText(/Viewers can open and reveal this credential but can.t change it/)).toBeVisible();
    await expect(page.getByTestId("save-credential")).toHaveCount(0);
  });

  test("gets 403 from every mutating API but may reveal", async ({ demoViewer, demoOwner }) => {
    const { api } = demoViewer;
    const credentialPath = `/api/credentials/${credential.id}`;
    const projectPath = `/api/projects/${project.id}`;

    const attempts = [
      api.post("/api/credentials", {
        data: { projectId: project.id, name: uniqueName("viewer"), type: "api-key", fields: { apiKey: "x" } },
      }),
      api.patch(credentialPath, { data: { description: "viewer edit" } }),
      api.put(credentialPath, { data: { description: "viewer edit" } }),
      api.delete(credentialPath),
      api.patch(projectPath, { data: { name: uniqueName("viewer rename") } }),
      api.delete(projectPath),
      api.post(`${projectPath}/members`, { data: { userId: demoViewer.id, role: "editor" } }),
    ];
    const statuses = await Promise.all(attempts.map(async (attempt) => (await attempt).status()));
    expect(statuses).toEqual(statuses.map(() => 403));

    // "Mark as rotated" is newer than some builds: a missing route answers 404 without a JSON envelope.
    const rotated = await api.post(`${credentialPath}/rotated`);
    const routeMissing = rotated.status() === 404 && !(rotated.headers()["content-type"] ?? "").includes("json");
    if (routeMissing) {
      test.info().annotations.push({ type: "note", description: "POST /api/credentials/[id]/rotated not deployed" });
    } else {
      expect(rotated.status(), "viewer mark-rotated").toBe(403);
    }

    // An explicit organisation project is not allowed for a viewer either.
    const createProject = await api.post("/api/projects", {
      data: { name: uniqueName("viewer project"), organizationId: project.organizationId },
    });
    if (createProject.ok()) {
      const created = await readData<CreatedProject>(createProject, "viewer project");
      await deleteProjectApi(demoOwner, created.id);
    }
    expect(createProject.status()).toBe(403);

    // Nothing changed.
    const after = await readData<CreatedCredential>(await demoOwner.api.get(credentialPath), "GET credential");
    expect(after.description).toBe(credential.description);

    const revealed = await readData<{ fields: Record<string, string> }>(
      await api.post(`${credentialPath}/reveal`),
      "viewer reveal"
    );
    expect(revealed.fields.password).toBe(credential.submittedFields.password);
  });
});

test.describe("invited organisation viewer", () => {
  test("a fresh account invited as viewer is read-only once it switches organisation", async ({
    page,
    actors,
    demoOwner,
  }) => {
    const orgId = demoOwner.orgId as string;
    const viewer = await createOrgMember(actors, demoOwner, orgId, "viewer");
    try {
      const session = await readData<{ organization: { id: string }; organizationRole: string }>(
        await viewer.api.get("/api/auth/session"),
        "viewer session"
      );
      expect(session).toMatchObject({ organization: { id: orgId }, organizationRole: "viewer" });

      const projects = await readData<CreatedProject[]>(await viewer.api.get("/api/projects"), "GET /api/projects");
      expect(projects.find((item) => item.id === project.id)?.currentUserRole).toBe("viewer");

      expect((await viewer.api.patch(`/api/credentials/${credential.id}`, { data: { name: "x" } })).status()).toBe(403);
      expect((await viewer.api.delete(`/api/projects/${project.id}`)).status()).toBe(403);
      const revealed = await readData<{ fields: Record<string, string> }>(
        await viewer.api.post(`/api/credentials/${credential.id}/reveal`),
        "viewer reveal"
      );
      expect(revealed.fields.password).toBe(credential.submittedFields.password);

      await signInPage(page, viewer);
      await page.goto(`/dashboard/projects/${project.id}`);
      await expect(page.getByText(/^Your role:\s*Viewer$/)).toBeVisible();
      await expect(page.getByTestId("add-credential-button")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Administration" })).toHaveCount(0);
    } finally {
      await removeOrganizationMember(demoOwner, orgId, viewer.id);
    }
  });
});

test.describe("organisation member", () => {
  test("creates a credential in an organisation project through the form", async ({ page, demoMember, demoOwner }) => {
    const name = uniqueName("Member key");
    await signInPage(page, demoMember);

    await page.goto(`/dashboard/projects/${project.id}`);
    await expect(page.getByText(/^Your role:\s*Editor$/)).toBeVisible();
    // Editors manage credentials but not the project itself.
    await expect(page.getByTestId("delete-project")).toHaveCount(0);
    await page.getByTestId("add-credential-button").click();

    await page.getByTestId("service-search").fill("api key");
    await page.getByTestId("service-option-api-key").click();
    await page.getByTestId("credential-name-input").fill(name);
    const firstSecret = page.locator('[data-testid^="field-"][type="password"]').first();
    await firstSecret.fill("member-secret-value-123");
    await page.getByTestId("save-credential").click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${project.id}/credentials/cred_[^/]+$`));
    await expect(page.getByTestId("credential-name")).toHaveText(name);
    const credentialId = page.url().split("/").pop() as string;

    const saved = await readData<CreatedCredential & { createdBy: string }>(
      await demoOwner.api.get(`/api/credentials/${credentialId}`),
      "GET credential"
    );
    expect(saved).toMatchObject({ projectId: project.id, type: "api-key", createdBy: demoMember.id });
    expect((await demoMember.api.delete(`/api/projects/${project.id}`)).status()).toBe(403);
  });

  test("gets access denied on admin pages and has no Admin navigation", async ({ page, demoMember }) => {
    await signInPage(page, demoMember);

    await page.goto("/dashboard");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Administration" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);

    await page.goto("/dashboard/admin");
    await expect(page.getByTestId("admin-access-denied")).toBeVisible();
    await expect(page.getByTestId("admin-stat-users")).toHaveCount(0);

    await page.goto("/dashboard/audit");
    await expect(page.getByTestId("audit-access-denied")).toBeVisible();
    await expect(page.getByTestId("audit-list")).toHaveCount(0);

    expect((await demoMember.api.get(`/api/organizations/${demoMember.orgId}/audit`)).status()).toBe(403);
    expect((await demoMember.api.get("/api/organizations/all/audit")).status()).toBe(403);
    expect((await demoMember.api.get("/api/users")).status()).toBe(403);
  });
});

test.describe("outsider", () => {
  test("gets 404 for another organisation's project and credential ids (IDOR)", async ({ page, actors }) => {
    const outsider = await actors.signUp();
    const { api } = outsider;
    const projectPath = `/api/projects/${project.id}`;
    const credentialPath = `/api/credentials/${credential.id}`;

    const checks: [string, Promise<{ status(): number; text(): Promise<string> }>][] = [
      ["GET project", api.get(projectPath)],
      ["PATCH project", api.patch(projectPath, { data: { name: "pwned" } })],
      ["DELETE project", api.delete(projectPath)],
      ["GET project members", api.get(`${projectPath}/members`)],
      ["GET credential", api.get(credentialPath)],
      ["PATCH credential", api.patch(credentialPath, { data: { description: "pwned" } })],
      ["DELETE credential", api.delete(credentialPath)],
      ["POST reveal", api.post(`${credentialPath}/reveal`)],
    ];
    for (const [label, pending] of checks) {
      const res = await pending;
      expect(res.status(), label).toBe(404);
      expect(await res.text(), `${label} leaks the secret`).not.toContain(credential.submittedFields.password);
    }

    const list = await readData<{ id: string }[]>(await api.get(`/api/credentials?projectId=${project.id}`), "list").catch(
      () => []
    );
    expect(list.map((item) => item.id)).not.toContain(credential.id);
    const projects = await readData<{ id: string }[]>(await api.get("/api/projects"), "GET /api/projects");
    expect(projects.map((item) => item.id)).not.toContain(project.id);

    await signInPage(page, outsider);
    await page.goto(`/dashboard/projects/${project.id}`);
    await expect(page.getByText("Project not found")).toBeVisible();
    await page.goto(`/dashboard/projects/${project.id}/credentials/${credential.id}`);
    await expect(page.getByText("Credential not found")).toBeVisible();
    await expect(page.getByText(credential.submittedFields.password)).toHaveCount(0);
  });
});

test.describe("CSRF", () => {
  test("rejects cross-origin state-changing requests", async ({ demoOwner }) => {
    const name = uniqueName("csrf");

    const evilOrigin = await demoOwner.api.post("/api/projects", {
      data: { name },
      headers: { Origin: "https://evil.example" },
    });
    expect(evilOrigin.status()).toBe(403);
    expect(await evilOrigin.json()).toMatchObject({ success: false });

    const nullOrigin = await demoOwner.api.post("/api/projects", { data: { name }, headers: { Origin: "null" } });
    expect(nullOrigin.status()).toBe(403);

    const crossSite = await demoOwner.api.post("/api/projects", {
      data: { name },
      headers: { "Sec-Fetch-Site": "cross-site" },
    });
    expect(crossSite.status()).toBe(403);

    const evilDelete = await demoOwner.api.delete(`/api/credentials/${credential.id}`, {
      headers: { Origin: "https://evil.example" },
    });
    expect(evilDelete.status()).toBe(403);
    expect((await demoOwner.api.get(`/api/credentials/${credential.id}`)).status()).toBe(200);

    const projects = await readData<{ name: string }[]>(await demoOwner.api.get("/api/projects"), "GET /api/projects");
    expect(projects.map((item) => item.name)).not.toContain(name);

    // Same-origin control request still works.
    const sameOrigin = await demoOwner.api.patch(`/api/projects/${project.id}`, { data: { description: "csrf ok" } });
    expect(sameOrigin.status()).toBe(200);
  });
});
