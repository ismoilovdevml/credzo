import type { Page } from "@playwright/test";
import {
  test as base,
  expect,
  fakeIpHeaders,
  originHeaders,
  signInViaUi,
  signupUser,
  totp,
  uniqueName,
  waitForHydration,
} from "./fixtures";

// Every test gets its own client IP: sign-ups and failed logins are rate-limited per IP.
const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide(fakeIpHeaders());
  },
});

const INVALID_CREDENTIALS = "Incorrect username, email or password.";

async function openSignup(page: Page) {
  await page.goto("/signup");
  await waitForHydration(page.getByTestId("signup-submit"));
}

async function fillSignup(
  page: Page,
  values: { firstName: string; lastName: string; username: string; email: string; password: string; confirm: string }
) {
  await page.getByTestId("signup-first-name").fill(values.firstName);
  await page.getByTestId("signup-last-name").fill(values.lastName);
  await page.getByTestId("signup-username").fill(values.username);
  await page.getByTestId("signup-email").fill(values.email);
  await page.getByTestId("signup-password").fill(values.password);
  await page.getByTestId("signup-confirm").fill(values.confirm);
}

async function openLogin(page: Page, query = "") {
  await page.goto(`/login${query}`);
  await waitForHydration(page.getByTestId("login-submit"));
}

async function submitLogin(page: Page, identifier: string, password: string) {
  await page.getByTestId("login-username").fill(identifier);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}

async function signOutViaMenu(page: Page) {
  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.describe("sign up", () => {
  test("happy path lands on the dashboard and greets the user by first name", async ({ page }) => {
    const username = uniqueName("signup");
    const password = "correct-horse-battery-1";
    await openSignup(page);
    await fillSignup(page, {
      firstName: "Zarina",
      lastName: "Karimova",
      username,
      email: `${username}@example.com`,
      password,
      confirm: password,
    });
    await page.getByTestId("signup-submit").click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("overview-greeting")).toHaveText(/^Good (morning|afternoon|evening), Zarina$/);

    const session = await page.request.get("/api/auth/session");
    expect(session.status()).toBe(200);
    const body = await session.json();
    expect(body.user.username).toBe(username);
    expect(body.user.role).toBe("user");
  });

  test("client-side validation blocks short passwords, mismatched confirmation and bad usernames", async ({ page }) => {
    const signupCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/signup")) signupCalls.push(request.url());
    });

    await openSignup(page);
    await fillSignup(page, {
      firstName: "Bad",
      lastName: "Input",
      username: "no spaces!",
      email: "bad-input@example.com",
      password: "short",
      confirm: "different",
    });
    await page.getByTestId("signup-submit").click();

    await expect(page.locator("#signup-username-error")).toHaveText("Use 3–32 letters, numbers or underscores.");
    await expect(page.locator("#signup-password-error")).toHaveText("Use at least 10 characters.");
    await expect(page.locator("#signup-confirm-error")).toHaveText("Passwords don't match.");
    await expect(page.getByTestId("signup-username")).toBeFocused();
    await expect(page.getByTestId("signup-username")).toHaveAttribute("aria-invalid", "true");

    // Fix the username and length, keep the mismatch: still blocked.
    await page.getByTestId("signup-username").fill(uniqueName("valid"));
    await page.getByTestId("signup-password").fill("long-enough-password");
    await page.getByTestId("signup-submit").click();
    await expect(page.locator("#signup-username-error")).toHaveCount(0);
    await expect(page.locator("#signup-password-error")).toHaveCount(0);
    await expect(page.locator("#signup-confirm-error")).toHaveText("Passwords don't match.");

    // Too short username.
    await page.getByTestId("signup-username").fill("ab");
    await page.getByTestId("signup-username").blur();
    await expect(page.locator("#signup-username-error")).toHaveText("Use 3–32 letters, numbers or underscores.");

    await expect(page).toHaveURL(/\/signup$/);
    expect(signupCalls, "invalid forms must not reach the API").toHaveLength(0);
  });

  test("a taken username is reported on the username field", async ({ page, request }) => {
    const existing = await signupUser(request);
    await openSignup(page);
    await fillSignup(page, {
      firstName: "Dup",
      lastName: "User",
      username: existing.username,
      email: `${uniqueName("dup")}@example.com`,
      password: "duplicate-user-pass",
      confirm: "duplicate-user-pass",
    });
    await page.getByTestId("signup-submit").click();

    await expect(page.locator("#signup-username-error")).toHaveText("This username is taken.");
    await expect(page.getByTestId("signup-error")).toBeVisible();
    await expect(page.getByTestId("signup-username")).toBeFocused();
    await expect(page).toHaveURL(/\/signup$/);
  });
});

test.describe("sign in", () => {
  test("works with the username", async ({ page, request }) => {
    const user = await signupUser(request, { firstName: "Bekzod" });
    await openLogin(page);
    await submitLogin(page, user.username, user.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("overview-greeting")).toContainText("Bekzod");
  });

  test("works with the email address", async ({ page, request }) => {
    const user = await signupUser(request, { firstName: "Sevara" });
    await openLogin(page);
    await submitLogin(page, user.email, user.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("overview-greeting")).toContainText("Sevara");
  });

  test("a wrong password and an unknown user get the same generic error", async ({ page, request }) => {
    const user = await signupUser(request);
    await openLogin(page);

    await submitLogin(page, user.username, "definitely-not-it");
    await expect(page.getByTestId("login-error")).toHaveText(INVALID_CREDENTIALS);
    await expect(page).toHaveURL(/\/login$/);

    await submitLogin(page, uniqueName("ghost"), "definitely-not-it");
    await expect(page.getByTestId("login-error")).toHaveText(INVALID_CREDENTIALS);
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.context().cookies()).some((cookie) => cookie.name === "session_token")).toBe(false);
  });

  test("sign out returns to /login and the dashboard then requires signing in again", async ({ page, request }) => {
    const user = await signupUser(request);
    await signInViaUi(page, user.username, user.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await signOutViaMenu(page);
    expect((await page.request.get("/api/auth/session")).status()).toBe(401);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("?next= is honoured for a same-site path", async ({ page, request }) => {
    const user = await signupUser(request);
    // The proxy builds this URL itself when a signed-out user opens a deep link.
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fsettings$/);
    await waitForHydration(page.getByTestId("login-submit"));
    await submitLogin(page, user.username, user.password);
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  });

  test("?next= pointing at another origin is ignored", async ({ page, request, baseURL }) => {
    const user = await signupUser(request);
    for (const evil of ["//evil.com", "/\\evil.com", "https://evil.com"]) {
      await page.context().clearCookies();
      await openLogin(page, `?next=${encodeURIComponent(evil)}`);
      await submitLogin(page, user.username, user.password);
      await expect(page).toHaveURL(`${baseURL}/dashboard`);
    }

    // Already signed in: the proxy's redirect from /login must ignore it too.
    const response = await page.request.get(`/login?next=${encodeURIComponent("//evil.com")}`, { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(new URL(response.headers()["location"], baseURL).origin).toBe(new URL(baseURL!).origin);
  });

  test("six wrong passwords for one account trigger the rate limit", async ({ page, request }) => {
    const user = await signupUser(request);
    await openLogin(page);

    for (let attempt = 1; attempt <= 5; attempt++) {
      await submitLogin(page, user.username, `wrong-password-${attempt}`);
      await expect(page.getByTestId("login-error")).toHaveText(INVALID_CREDENTIALS);
      await expect(page.getByTestId("login-submit")).toBeEnabled();
    }

    const sixth = page.waitForResponse((response) => response.url().endsWith("/api/auth/login"));
    await submitLogin(page, user.username, "wrong-password-6");
    const response = await sixth;
    expect(response.status()).toBe(429);
    expect(Number(response.headers()["retry-after"])).toBeGreaterThan(0);
    await expect(page.getByTestId("login-error")).toHaveText(/^Too many attempts — try again in \d+ minutes?\.$/);

    // Even the right password is refused while the limit is active.
    const blocked = page.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
    await submitLogin(page, user.username, user.password);
    expect((await blocked).status()).toBe(429);
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("two-factor authentication", () => {
  test("enable in Settings, then sign in with an authenticator code", async ({ page }) => {
    const user = await signupUser(page.request, { firstName: "Otabek" });
    await page.goto("/dashboard/settings");

    await expect(page.getByTestId("twofa-status")).toHaveText("Off");
    await waitForHydration(page.getByTestId("twofa-enable"));
    await page.getByTestId("twofa-enable").click();

    const secretText = await page.getByTestId("twofa-secret").textContent();
    const secret = (secretText ?? "").replace(/\s/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    await page.getByTestId("twofa-code").fill(totp(secret));
    await page.getByTestId("twofa-confirm").click();

    const codes = page.getByTestId("backup-codes").locator("li");
    await expect(codes).toHaveCount(10);
    for (const code of await codes.allTextContents()) expect(code.trim()).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
    await expect(page.getByTestId("backup-codes-done")).toBeDisabled();
    await page.getByTestId("backup-codes-saved").check();
    await page.getByTestId("backup-codes-done").click();
    await expect(page.getByTestId("twofa-status")).toHaveText("On");

    await signOutViaMenu(page);

    await waitForHydration(page.getByTestId("login-submit"));
    await submitLogin(page, user.username, user.password);
    const codeInput = page.getByTestId("twofa-code");
    await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible();
    expect((await page.context().cookies()).some((cookie) => cookie.name === "session_token")).toBe(false);

    // The enable step used the current 30 s step; codes are replay-protected, so use the next one.
    await codeInput.fill(totp(secret, Date.now() + 30_000));
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("overview-greeting")).toContainText("Otabek");
  });

  test("a backup code signs in exactly once", async ({ page, request }) => {
    const user = await signupUser(request);
    const setup = await request.post("/api/account/2fa/setup", { headers: originHeaders() });
    expect(setup.status()).toBe(200);
    const { secret } = (await setup.json()).data as { secret: string };
    const enable = await request.post("/api/account/2fa/enable", {
      headers: originHeaders(),
      data: { code: totp(secret) },
    });
    expect(enable.status()).toBe(200);
    const backupCodes = (await enable.json()).data.backupCodes as string[];
    expect(backupCodes).toHaveLength(10);
    const backupCode = backupCodes[3];

    const signInWithBackup = async () => {
      await openLogin(page);
      await submitLogin(page, user.username, user.password);
      await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible();
      await page.getByTestId("twofa-use-backup").click();
      await page.getByTestId("twofa-code").fill(backupCode);
      await page.getByTestId("twofa-submit").click();
    };

    await signInWithBackup();
    await expect(page).toHaveURL(/\/dashboard$/);

    const profile = await page.request.get("/api/user-profile");
    expect((await profile.json()).data.backupCodesRemaining).toBe(9);

    await page.context().clearCookies();
    await signInWithBackup();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.context().cookies()).some((cookie) => cookie.name === "session_token")).toBe(false);
  });
});
