import type { Browser, Page, TestInfo } from "@playwright/test";
import {
  test as base,
  expect,
  createProjectViaApi,
  fakeIpHeaders,
  newIsolatedContext,
  signupUser,
  uniqueName,
  waitForHydration,
} from "./fixtures";

// Every test gets its own client IP: sign-ups and share opens are rate-limited per IP.
const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide(fakeIpHeaders());
  },
});

const LOWER = /^[a-z]+$/;

async function openGenerator(page: Page) {
  await page.goto("/dashboard/generator");
  await expect(page.getByRole("heading", { level: 1, name: "Generator & secure share" })).toBeVisible();
  await waitForHydration(page.getByTestId("generator-copy"));
}

async function output(page: Page): Promise<string> {
  return (await page.getByTestId("generator-output").textContent()) ?? "";
}

/** Creates a link through the form and returns its URL (with the #key fragment). */
async function createLink(
  page: Page,
  options: { secret: string; label: string; passphrase?: string; views?: "1 view" | "3 views" }
): Promise<string> {
  await page.getByTestId("share-secret").fill(options.secret);
  await page.getByTestId("share-label").fill(options.label);
  if (options.views) await page.getByTestId("share-views").getByRole("button", { name: options.views }).click();
  if (options.passphrase) {
    await page.getByTestId("share-require-passphrase").check();
    await page.getByTestId("share-passphrase").fill(options.passphrase);
  }
  await page.getByTestId("create-link").click();
  const link = page.getByTestId("share-link-output");
  await expect(link).toHaveText(/\/s\/[A-Za-z0-9_-]{22}#.+/);
  await expect(page.getByTestId("share-secret")).toHaveValue("");
  await expect(page.getByTestId("active-link-row").filter({ hasText: options.label })).toHaveAttribute(
    "data-status",
    "active"
  );
  return (await link.textContent())!.trim();
}

/** Opens a link the way a recipient would: a separate, signed-out browser context. */
async function openAsRecipient(browser: Browser, testInfo: TestInfo, url: string) {
  const context = await newIsolatedContext(browser, testInfo);
  const page = await context.newPage();
  await page.goto(url);
  return { context, page };
}

function shareId(url: string): string {
  return new URL(url).pathname.split("/").pop()!;
}

test.describe("password generator", () => {
  test.beforeEach(async ({ page }) => {
    await signupUser(page.request);
    await openGenerator(page);
  });

  test("length options change the output length", async ({ page }) => {
    await expect(page.getByTestId("length-option-24")).toHaveAttribute("aria-pressed", "true");
    expect(await output(page)).toHaveLength(24);

    for (const length of [12, 16, 32, 48]) {
      await page.getByTestId(`length-option-${length}`).click();
      await expect(page.getByTestId(`length-option-${length}`)).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("generator-output")).toHaveText(new RegExp(`^.{${length}}$`));
    }
    await expect(page.getByTestId("length-option-24")).toHaveAttribute("aria-pressed", "false");

    const before = await output(page);
    await page.getByTestId("generator-regenerate").click();
    await expect(page.getByTestId("generator-output")).not.toHaveText(before);
    expect(await output(page)).toHaveLength(48);
  });

  test("character-set toggles control the characters used", async ({ page }) => {
    await page.getByTestId("length-option-48").click();

    for (const key of ["upper", "digits", "symbols"]) {
      await page.getByTestId(`charset-${key}`).click();
      await expect(page.getByTestId(`charset-${key}`)).toHaveAttribute("aria-pressed", "false");
    }
    await expect(page.getByTestId("generator-output")).toHaveText(LOWER);
    // Ambiguous characters (l) are excluded by default.
    for (let i = 0; i < 5; i++) {
      expect(await output(page)).not.toContain("l");
      await page.getByTestId("generator-regenerate").click();
    }

    // The last enabled set cannot be turned off.
    const lower = page.getByTestId("charset-lower");
    await expect(lower).toHaveAttribute("aria-disabled", "true");
    await lower.click({ force: true });
    await expect(lower).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("At least one character set must stay on.")).toBeVisible();

    // Digits only.
    await page.getByTestId("charset-digits").click();
    await page.getByTestId("charset-lower").click();
    await expect(page.getByTestId("generator-output")).toHaveText(/^[2-9]{48}$/);

    // Allowing ambiguous characters brings 0 and 1 back into the pool.
    await page.getByTestId("exclude-ambiguous").uncheck();
    await expect(page.getByTestId("charset-digits")).toContainText("0–9");
    await expect(page.getByTestId("generator-output")).toHaveText(/^[0-9]{48}$/);

    // Symbols only.
    await page.getByTestId("charset-symbols").click();
    await page.getByTestId("charset-digits").click();
    await expect(page.getByTestId("generator-output")).toHaveText(/^[!@#$%^&*\-_=+?~]{48}$/);
  });

  test("copy puts the generated password on the clipboard", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only in Playwright");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const password = await output(page);

    await page.getByTestId("generator-copy").click();
    await expect(page.getByTestId("generator-copy")).toHaveText("Copied");
    await expect(page.getByText("Password copied. Clipboard clears in 30s.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(password);
  });

  test("'Save as new credential' hands the password to the new-credential form without putting it in the URL", async ({
    page,
  }) => {
    const projectName = uniqueName("Generator target");
    const projectId = await createProjectViaApi(page.request, projectName);
    await page.reload();
    await waitForHydration(page.getByTestId("save-as-credential"));
    const password = await output(page);

    const visited: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url());
    });
    page.on("request", (request) => visited.push(request.url()));

    await page.getByTestId("save-as-credential").click();
    const dialog = page.getByRole("dialog", { name: "Save as new credential" });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("save-credential-continue")).toBeDisabled();
    await page.getByTestId("save-project-option").filter({ hasText: projectName }).click();
    await page.getByTestId("save-credential-continue").click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${projectId}/credentials/new$`));
    await page.getByTestId("service-search").fill("PostgreSQL");
    await page.getByTestId("service-option-postgresql").click();
    await expect(page.getByTestId("field-password")).toHaveValue(password);

    // The hand-off is one-shot and never travels in a URL.
    expect(await page.evaluate(() => sessionStorage.getItem("credzo:prefill-secret"))).toBeNull();
    for (const url of visited) {
      expect(url).not.toContain(password);
      expect(url).not.toContain(encodeURIComponent(password));
    }
  });
});

test.describe("one-time secure links", () => {
  test.beforeEach(async ({ page }) => {
    await signupUser(page.request);
    await openGenerator(page);
  });

  test("a single-view link: checking it is free, revealing shows the exact secret, then it is gone", async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const secret = `postgres://app:Pa55-${uniqueName("x")}@db:5432/app\nsecond line ✓`;
    const label = uniqueName("one view");
    const url = await createLink(page, { secret, label });
    const id = shareId(url);
    expect(url).not.toContain(encodeURIComponent(secret));

    const recipient = await openAsRecipient(browser, testInfo, url);
    try {
      const reveal = recipient.page.getByTestId("reveal-secret");
      await expect(reveal).toBeVisible();
      await expect(recipient.page.getByText("Revealing it uses the last view.", { exact: false })).toBeVisible();

      // Looking at the landing step does not consume the view.
      await recipient.page.reload();
      await expect(reveal).toBeVisible();
      const meta = await (await request.get(`/api/shares/${id}/meta`)).json();
      expect(meta.data).toMatchObject({ exists: true, viewsLeft: 1, requiresPassphrase: false });

      await waitForHydration(reveal);
      await reveal.click();
      await expect(recipient.page.getByTestId("revealed-secret")).toHaveText(secret, { useInnerText: false });
      expect(await recipient.page.getByTestId("revealed-secret").textContent()).toBe(secret);
      await expect(recipient.page.getByText("This was the last view")).toBeVisible();

      // A second visit finds nothing.
      const again = await recipient.context.newPage();
      await again.goto(url);
      await expect(again.getByTestId("share-unavailable-consumed")).toContainText("Already viewed");
      await expect(again.getByTestId("reveal-secret")).toHaveCount(0);
    } finally {
      await recipient.context.close();
    }

    // The owner's list shows it as opened, with no revoke action.
    await page.reload();
    const row = page.getByTestId("active-link-row").filter({ hasText: label });
    await expect(row).toHaveAttribute("data-status", "opened");
    await expect(row.getByTestId("revoke-link")).toHaveCount(0);
  });

  test("a passphrase link warns, rejects a wrong passphrase and opens with the right one", async ({
    page,
    browser,
  }, testInfo) => {
    const secret = `token-${uniqueName("pp")}`;
    const passphrase = "blue-river-42";
    const label = uniqueName("passphrase");
    const url = await createLink(page, { secret, label, passphrase });
    await expect(
      page.getByTestId("active-link-row").filter({ hasText: label }).getByRole("img", { name: "Passphrase required" })
    ).toBeVisible();

    const recipient = await openAsRecipient(browser, testInfo, url);
    try {
      const p = recipient.page;
      await expect(p.getByTestId("share-passphrase-warning")).toContainText("Revealing uses a view even if the passphrase is wrong");
      await waitForHydration(p.getByTestId("reveal-secret"));

      // Empty passphrase is caught locally, without consuming the view.
      await p.getByTestId("reveal-secret").click();
      await expect(p.getByText("Enter the passphrase the sender gave you.")).toBeVisible();

      await p.getByTestId("share-open-passphrase").fill("wrong-passphrase");
      await p.getByTestId("reveal-secret").click();
      await expect(p.getByText("Wrong passphrase. Check it with the sender and try again.")).toBeVisible();
      await expect(p.getByTestId("reveal-secret")).toHaveText("Try passphrase");
      await expect(p.getByTestId("revealed-secret")).toHaveCount(0);

      await p.getByTestId("share-open-passphrase").fill(passphrase);
      await p.getByTestId("reveal-secret").click();
      await expect(p.getByTestId("revealed-secret")).toHaveText(secret);
    } finally {
      await recipient.context.close();
    }
  });

  test("revoking from 'Your active links' makes the link show as revoked", async ({ page, browser }, testInfo) => {
    const label = uniqueName("revoke me");
    const url = await createLink(page, { secret: `revocable-${uniqueName("r")}`, label, views: "3 views" });

    const row = page.getByTestId("active-link-row").filter({ hasText: label });
    await row.getByTestId("revoke-link").click();
    const confirm = page.getByRole("alertdialog", { name: "Revoke this link?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Revoke link" }).click();
    await expect(page.getByText("Link revoked. The encrypted secret was deleted.")).toBeVisible();
    await expect(row).toHaveAttribute("data-status", "revoked");
    await expect(row).toContainText("Revoked");
    await expect(row.getByTestId("revoke-link")).toHaveCount(0);

    const recipient = await openAsRecipient(browser, testInfo, url);
    try {
      await expect(recipient.page.getByTestId("share-unavailable-revoked")).toContainText("This link was revoked");
      await expect(recipient.page.getByTestId("reveal-secret")).toHaveCount(0);
    } finally {
      await recipient.context.close();
    }
  });
});
