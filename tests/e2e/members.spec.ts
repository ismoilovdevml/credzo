import type { Page } from "@playwright/test";
import {
  DEMO_USERS,
  addOrganizationMember,
  expect,
  readData,
  removeOrganizationMember,
  roleTest as test,
  signInPage,
  uniqueName,
  type Actor,
} from "./fixtures";

/**
 * Organisation members screen. Mutations only touch freshly signed-up accounts
 * that the demo owner adds to (and removes from) the demo organisation.
 */

interface OrgMemberRow {
  userId: string;
  role: string;
  user: { username: string; email: string } | null;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
}

function memberRow(page: Page, username: string) {
  return page.locator(`[data-testid="member-row"][data-username="${username}"]`);
}

async function orgMembers(admin: Actor): Promise<OrgMemberRow[]> {
  return readData<OrgMemberRow[]>(
    await admin.api.get(`/api/organizations/${admin.orgId}/members`),
    "GET organisation members"
  );
}

async function roleOf(admin: Actor, userId: string): Promise<string | null> {
  return (await orgMembers(admin)).find((member) => member.userId === userId)?.role ?? null;
}

test.describe("organisation members", () => {
  test("owner invites an existing user by email as a member", async ({ page, demoOwner, actors }) => {
    const invitee = await actors.signUp();
    try {
      await signInPage(page, demoOwner);
      await page.goto("/dashboard/members");
      await expect(memberRow(page, demoOwner.username)).toBeVisible();
      await expect(memberRow(page, invitee.username)).toHaveCount(0);

      await page.getByTestId("invite-member-button").click();
      const dialog = page.getByRole("dialog", { name: "Invite a member" });
      await dialog.getByTestId("invite-email-input").fill(invitee.email);
      await dialog.getByTestId("invite-role-select").selectOption("member");
      await dialog.getByTestId("invite-submit").click();

      await expect(dialog).toBeHidden();
      const row = memberRow(page, invitee.username);
      await expect(row).toBeVisible();
      await expect(row).toContainText(invitee.email);
      await expect(row.getByTestId("member-role-select")).toHaveValue("member");
      expect(await roleOf(demoOwner, invitee.id)).toBe("member");

      // The invitee now sees the organisation in their switcher list.
      const session = await readData<{ organizations: { id: string; role: string }[] }>(
        await invitee.api.get("/api/auth/session"),
        "invitee session"
      );
      expect(session.organizations).toContainEqual(expect.objectContaining({ id: demoOwner.orgId, role: "member" }));
    } finally {
      await removeOrganizationMember(demoOwner, demoOwner.orgId as string, invitee.id);
    }
  });

  test("owner changes a member's role", async ({ page, demoOwner, actors }) => {
    const target = await actors.signUp();
    await addOrganizationMember(demoOwner, demoOwner.orgId as string, target.email, "member");
    try {
      await signInPage(page, demoOwner);
      await page.goto("/dashboard/members");
      const select = memberRow(page, target.username).getByTestId("member-role-select");
      await expect(select).toHaveValue("member");

      await select.selectOption("viewer");
      await expect(page.getByText(/is now viewer\./)).toBeVisible();
      await expect.poll(() => roleOf(demoOwner, target.id)).toBe("viewer");

      await page.reload();
      await expect(memberRow(page, target.username).getByTestId("member-role-select")).toHaveValue("viewer");
    } finally {
      await removeOrganizationMember(demoOwner, demoOwner.orgId as string, target.id);
    }
  });

  test("owner removes a member after confirming", async ({ page, demoOwner, actors }) => {
    const target = await actors.signUp();
    await addOrganizationMember(demoOwner, demoOwner.orgId as string, target.email, "viewer");
    try {
      await signInPage(page, demoOwner);
      await page.goto("/dashboard/members");
      const row = memberRow(page, target.username);
      await expect(row).toBeVisible();

      await row.getByTestId("remove-member").click();
      const confirm = page.getByRole("alertdialog", { name: "Remove member?" });
      await confirm.getByRole("button", { name: "Cancel" }).click();
      await expect(confirm).toBeHidden();
      expect(await roleOf(demoOwner, target.id)).toBe("viewer");

      await row.getByTestId("remove-member").click();
      await confirm.getByRole("button", { name: "Remove member" }).click();
      await expect(row).toHaveCount(0);
      expect(await roleOf(demoOwner, target.id)).toBeNull();
    } finally {
      await removeOrganizationMember(demoOwner, demoOwner.orgId as string, target.id);
    }
  });

  test("inviting an unknown email records a pending invitation", async ({ page, demoOwner }) => {
    const email = `${uniqueName("nobody")}@example.com`;
    const orgId = demoOwner.orgId as string;
    try {
      await signInPage(page, demoOwner);
      await page.goto("/dashboard/members");
      await page.getByTestId("invite-member-button").click();
      const dialog = page.getByRole("dialog", { name: "Invite a member" });
      await dialog.getByTestId("invite-email-input").fill(email);
      await dialog.getByTestId("invite-role-select").selectOption("viewer");
      await dialog.getByTestId("invite-submit").click();

      const saved = page.getByRole("dialog", { name: "Invitation saved" });
      await expect(saved).toContainText(email);
      await expect(saved).toContainText("doesn't have a Credzo account yet");
      await expect(saved).toContainText("as viewer");
      await saved.getByRole("button", { name: "Done" }).click();

      const pending = page.getByTestId("pending-invitations");
      await expect(pending.locator(`[data-testid="invitation-row"][data-email="${email}"]`)).toBeVisible();

      // A second invite for the same email is a conflict.
      const duplicate = await demoOwner.api.post(`/api/organizations/${orgId}/members`, {
        data: { email, role: "viewer" },
      });
      expect(duplicate.status()).toBe(409);
    } finally {
      // Best-effort: revoke the invitation so the pending list stays short.
      const res = await demoOwner.api.get(`/api/organizations/${orgId}/invitations`);
      if (res.ok()) {
        const { data } = (await res.json()) as { data: InvitationRow[] };
        for (const invitation of data.filter((item) => item.email === email)) {
          await demoOwner.api.delete(`/api/organizations/${orgId}/invitations/${invitation.id}`);
        }
      }
    }
  });

  test("admin cannot change or remove the owner", async ({ page, demoAdmin }) => {
    await signInPage(page, demoAdmin);
    await page.goto("/dashboard/members");

    const ownerRow = memberRow(page, DEMO_USERS.owner);
    await expect(ownerRow).toBeVisible();
    await expect(ownerRow.getByTestId("member-role-select")).toHaveCount(0);
    await expect(ownerRow.getByTestId("remove-member")).toHaveCount(0);

    // Admins still manage regular members, but cannot grant owner.
    const memberSelect = memberRow(page, DEMO_USERS.member).getByTestId("member-role-select");
    await expect(memberSelect).toBeVisible();
    await expect(memberSelect.locator('option[value="owner"]')).toHaveCount(0);
    // Their own row is not removable.
    await expect(memberRow(page, DEMO_USERS.admin).getByTestId("remove-member")).toHaveCount(0);

    const ownerId = (await orgMembers(demoAdmin)).find((member) => member.user?.username === DEMO_USERS.owner)?.userId;
    expect(ownerId).toBeTruthy();
    const demote = await demoAdmin.api.put(`/api/organizations/${demoAdmin.orgId}/members/${ownerId}`, {
      data: { role: "viewer" },
    });
    expect(demote.status()).toBe(403);
    const remove = await demoAdmin.api.delete(`/api/organizations/${demoAdmin.orgId}/members/${ownerId}`);
    expect(remove.status()).toBe(403);
  });

  test("viewer sees a read-only member list", async ({ page, demoViewer }) => {
    await signInPage(page, demoViewer);
    await page.goto("/dashboard/members");

    await expect(page.getByTestId("members-list")).toBeVisible();
    await expect(memberRow(page, DEMO_USERS.owner)).toBeVisible();
    await expect(memberRow(page, DEMO_USERS.viewer)).toContainText("You");
    await expect(page.getByText(/Only owners and admins can invite people or change roles/)).toBeVisible();
    await expect(page.getByTestId("invite-member-button")).toHaveCount(0);
    await expect(page.getByTestId("member-role-select")).toHaveCount(0);
    await expect(page.getByTestId("remove-member")).toHaveCount(0);
    await expect(page.getByTestId("pending-invitations")).toHaveCount(0);

    const invite = await demoViewer.api.post(`/api/organizations/${demoViewer.orgId}/members`, {
      data: { email: `${uniqueName("viewer_invite")}@example.com`, role: "viewer" },
    });
    expect(invite.status()).toBe(403);
  });
});
