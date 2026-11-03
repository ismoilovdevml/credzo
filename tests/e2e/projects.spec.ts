import type { Page } from "@playwright/test";
import {
  createCredentialApi,
  createProjectApi,
  expect,
  readData,
  roleTest as test,
  signInPage,
  uniqueName,
  type Actor,
  type CreatedProject,
} from "./fixtures";

/**
 * Every test signs up its own account, so project counts, filters and sort
 * orders only ever see the projects that test created.
 */

function sidebarProjectsLink(page: Page) {
  return page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Projects/ });
}

function projectCards(page: Page) {
  return page.getByTestId("project-card");
}

async function cardNames(page: Page): Promise<string[]> {
  return projectCards(page).locator("h2").allInnerTexts();
}

async function getProject(actor: Actor, id: string) {
  return actor.api.get(`/api/projects/${id}`);
}

test.describe("projects", () => {
  test("creates an organisation project from the UI and lands on its detail page", async ({ page, actors }) => {
    const owner = await actors.signUp();
    await signInPage(page, owner);
    const name = uniqueName("Org project");

    await page.goto("/dashboard/projects");
    await expect(page.getByTestId("projects-empty")).toBeVisible();
    await expect(sidebarProjectsLink(page)).toHaveText(/Projects\s*0$/);

    await page.getByTestId("new-project-button").click();
    await expect(page).toHaveURL(/\/dashboard\/projects\/new$/);
    await page.getByTestId("project-name-input").fill(name);
    await page.getByTestId("project-description-input").fill("Created by the e2e suite");
    // Owners of an organisation default to an organisation-wide project.
    await expect(page.getByTestId("scope-organization")).toBeChecked();
    await page.getByTestId("create-project-submit").click();

    await expect(page).toHaveURL(/\/dashboard\/projects\/proj_[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(sidebarProjectsLink(page)).toHaveText(/Projects\s*1$/);

    const id = page.url().split("/").pop() as string;
    const project = await readData<CreatedProject>(await getProject(owner, id), "GET project");
    expect(project.name).toBe(name);
    expect(project.organizationId).toBe(owner.orgId);
    expect(project.currentUserRole).toBe("owner");
  });

  test("creates a personal project from the UI", async ({ page, actors }) => {
    const owner = await actors.signUp();
    await createProjectApi(owner, { name: uniqueName("Existing") });
    await signInPage(page, owner);
    const name = uniqueName("Personal project");

    await page.goto("/dashboard/projects/new");
    await expect(sidebarProjectsLink(page)).toHaveText(/Projects\s*1$/);
    await page.getByTestId("project-name-input").fill(name);
    await page.getByTestId("scope-personal").check();
    await page.getByTestId("create-project-submit").click();

    await expect(page).toHaveURL(/\/dashboard\/projects\/proj_[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByText("Personal", { exact: true })).toBeVisible();
    await expect(sidebarProjectsLink(page)).toHaveText(/Projects\s*2$/);

    const id = page.url().split("/").pop() as string;
    const project = await readData<CreatedProject>(await getProject(owner, id), "GET project");
    expect(project.organizationId).toBeNull();
  });

  test("rejects a too-short project name without calling the API", async ({ page, actors }) => {
    const owner = await actors.signUp();
    await signInPage(page, owner);

    await page.goto("/dashboard/projects/new");
    await page.getByTestId("project-name-input").fill("x");
    await page.getByTestId("create-project-submit").click();

    await expect(page.getByText(/Use at least \d+ characters/)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/projects\/new$/);
    const projects = await readData<unknown[]>(await owner.api.get("/api/projects"), "GET /api/projects");
    expect(projects).toHaveLength(0);
  });

  test("top-bar search (Ctrl/⌘+K) opens the projects page filtered by ?q=", async ({ page, actors }) => {
    const owner = await actors.signUp();
    const token = uniqueName("needle").toLowerCase();
    const match = await createProjectApi(owner, { name: `Billing ${token}` });
    await createProjectApi(owner, { name: uniqueName("Unrelated") });
    await signInPage(page, owner);

    await page.goto("/dashboard");
    await expect(page.getByTestId("overview-greeting")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByRole("searchbox", { name: "Search projects" }).first();
    await expect(search).toBeFocused();
    await page.keyboard.type(token);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(new RegExp(`/dashboard/projects\\?q=${token}$`));
    await expect(page.getByTestId("projects-search")).toHaveValue(token);
    await expect(projectCards(page)).toHaveCount(1);
    await expect(projectCards(page).first()).toHaveAttribute("data-project-id", match.id);

    // A term with no match shows the no-results state, and clearing it restores the list.
    await page.goto(`/dashboard/projects?q=${uniqueName("nothing")}`);
    await expect(page.getByTestId("projects-no-results")).toBeVisible();
    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await expect(projectCards(page)).toHaveCount(2);
    await expect(page).toHaveURL(/\/dashboard\/projects$/);
  });

  test("filters personal and organisation projects", async ({ page, actors }) => {
    const owner = await actors.signUp();
    const orgProject = await createProjectApi(owner, { name: uniqueName("Team") });
    const personal = await createProjectApi(owner, { name: uniqueName("Mine"), organizationId: null });
    await signInPage(page, owner);

    await page.goto("/dashboard/projects");
    const filter = page.getByRole("group", { name: "Filter projects" });
    await expect(projectCards(page)).toHaveCount(2);
    await expect(filter.getByRole("button", { name: /^All\s*2$/ })).toHaveAttribute("aria-pressed", "true");

    await filter.getByRole("button", { name: /^Personal\s*1$/ }).click();
    await expect(projectCards(page)).toHaveCount(1);
    await expect(projectCards(page).first()).toHaveAttribute("data-project-id", personal.id);

    await filter.getByRole("button", { name: /^Organisation\s*1$/ }).click();
    await expect(projectCards(page)).toHaveCount(1);
    await expect(projectCards(page).first()).toHaveAttribute("data-project-id", orgProject.id);

    await filter.getByRole("button", { name: /^All/ }).click();
    await expect(projectCards(page)).toHaveCount(2);
  });

  test("sorts by name, credential count and recent update", async ({ page, actors }) => {
    const owner = await actors.signUp();
    const suffix = uniqueName("s");
    const bravo = await createProjectApi(owner, { name: `Bravo ${suffix}` });
    const alpha = await createProjectApi(owner, { name: `Alpha ${suffix}` });
    const charlie = await createProjectApi(owner, { name: `Charlie ${suffix}` });
    await createCredentialApi(owner, bravo.id);
    await createCredentialApi(owner, bravo.id);
    await createCredentialApi(owner, charlie.id);
    // Alpha was created before Charlie, so only this edit can make it the most recently updated.
    await readData(
      await owner.api.patch(`/api/projects/${alpha.id}`, { data: { description: "touched" } }),
      "PATCH project"
    );
    await signInPage(page, owner);

    await page.goto("/dashboard/projects");
    await expect(projectCards(page)).toHaveCount(3);

    const sortBy = async (label: string) => {
      await page.getByTestId("projects-sort").click();
      await page.getByRole("menuitem", { name: new RegExp(`^${label}`) }).click();
      await expect(page.getByTestId("projects-sort")).toContainText(label);
    };

    await sortBy("Name");
    await expect.poll(() => cardNames(page)).toEqual([alpha.name, bravo.name, charlie.name]);

    await sortBy("Most credentials");
    await expect.poll(() => cardNames(page)).toEqual([bravo.name, charlie.name, alpha.name]);

    await sortBy("Recently updated");
    await expect.poll(async () => (await cardNames(page))[0]).toBe(alpha.name);
  });

  test("edits a project's name and description", async ({ page, actors }) => {
    const owner = await actors.signUp();
    const project = await createProjectApi(owner, { name: uniqueName("Before"), description: "Old description" });
    const newName = uniqueName("After");
    await signInPage(page, owner);

    await page.goto(`/dashboard/projects/${project.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(project.name);
    await page.getByTestId("edit-project").click();

    const dialog = page.getByRole("dialog", { name: "Edit project" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Name").fill(newName);
    await dialog.getByLabel("Description").fill("New description");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(newName);
    await expect(page.getByText("New description")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(newName);
    const saved = await readData<CreatedProject>(await getProject(owner, project.id), "GET project");
    expect(saved).toMatchObject({ name: newName, description: "New description" });
  });

  test("deletes a project only after confirming", async ({ page, actors }) => {
    const owner = await actors.signUp();
    const keep = await createProjectApi(owner, { name: uniqueName("Keep") });
    const doomed = await createProjectApi(owner, { name: uniqueName("Doomed") });
    await createCredentialApi(owner, doomed.id);
    await signInPage(page, owner);

    await page.goto(`/dashboard/projects/${doomed.id}`);
    await expect(sidebarProjectsLink(page)).toHaveText(/Projects\s*2$/);

    await page.getByTestId("delete-project").click();
    const confirm = page.getByRole("alertdialog", { name: "Delete project?" });
    await expect(confirm).toContainText(doomed.name);
    await expect(confirm).toContainText("1 credential and their secrets");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    expect((await getProject(owner, doomed.id)).status()).toBe(200);

    await page.getByTestId("delete-project").click();
    await confirm.getByRole("button", { name: "Delete project" }).click();

    await expect(page).toHaveURL(/\/dashboard\/projects$/);
    await expect(projectCards(page)).toHaveCount(1);
    await expect(projectCards(page).first()).toHaveAttribute("data-project-id", keep.id);
    await expect(sidebarProjectsLink(page)).toHaveText(/Projects\s*1$/);
    expect((await getProject(owner, doomed.id)).status()).toBe(404);
  });
});
