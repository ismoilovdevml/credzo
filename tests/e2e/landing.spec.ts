import type { Page } from "@playwright/test";
import { test, expect, waitForHydration } from "./fixtures";

const SECTIONS = [
  { href: "#features", label: "Features" },
  { href: "#services", label: "Integrations" },
  { href: "#security", label: "Security" },
  { href: "#how", label: "How it works" },
];

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth > window.innerWidth;
  });
}

test.describe("landing page", () => {
  test("hero renders its heading and the calls to action point at sign-up and sign-in", async ({ page }) => {
    await page.goto("/");

    // The brand suffix is not asserted here: "/" shares the root layout's segment, so the
    // "%s · Credzo" template does not apply (see the app-bug list / smoke.spec).
    await expect(page).toHaveTitle(/credential vault/i);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Every server, database and API key your team owns. One calm, encrypted place."
    );
    await expect(page.getByTestId("hero-create-vault")).toHaveAttribute("href", "/signup");
    await expect(page.getByTestId("hero-see-dashboard")).toHaveAttribute("href", "/login");
    await expect(page.getByTestId("cta-create-vault")).toHaveAttribute("href", "/signup");
    await expect(page.getByTestId("landing-signin-link")).toHaveAttribute("href", "/login");
    await expect(page.getByTestId("landing-get-started-link")).toHaveAttribute("href", "/signup");
    await expect(page.getByTestId("landing-features").locator("li")).not.toHaveCount(0);
    await expect(page.getByTestId("service-chip").first()).toBeVisible();
  });

  test("hero CTAs navigate to the sign-up and sign-in pages", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("hero-create-vault").click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

    await page.goto("/");
    await page.getByTestId("hero-see-dashboard").click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("theme toggle switches the html class to dark and back, and persists across reloads", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);

    const toDark = page.getByRole("button", { name: "Switch to dark theme" });
    await waitForHydration(toDark);
    await toDark.click();
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");

    // An explicit choice must survive a reload even when the OS prefers the other scheme.
    await page.reload();
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);

    const toLight = page.getByRole("button", { name: "Switch to light theme" });
    await waitForHydration(toLight);
    await toLight.click();
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
    await expect(html).toHaveClass(/(^|\s)light(\s|$)/);
  });

  test("section navigation anchors exist and scroll to their sections", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const nav = page.getByTestId("landing-nav");
    await expect(nav).toBeVisible();

    const links = nav.getByRole("link");
    await expect(links).toHaveCount(SECTIONS.length);
    for (const [index, section] of SECTIONS.entries()) {
      const link = links.nth(index);
      await expect(link).toHaveText(section.label);
      await expect(link).toHaveAttribute("href", section.href);
      await expect(page.locator(section.href)).toHaveCount(1);
    }

    for (const section of SECTIONS) {
      await nav.getByRole("link", { name: section.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${section.href}$`));
      await expect(page.locator(section.href)).toBeInViewport();
    }
  });

  test("mobile menu opens, navigates and closes @mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const button = page.getByTestId("landing-mobile-menu-button");
    const menu = page.getByTestId("landing-mobile-menu");
    await expect(page.getByTestId("landing-nav")).toBeHidden();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    await waitForHydration(button);
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toHaveAccessibleName("Close menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await expect(menu.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");

    // A section link closes the menu and jumps to the section.
    await menu.getByRole("link", { name: "Security" }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#security$/);

    // Toggle button closes it.
    await button.click();
    await expect(menu).toBeVisible();
    await button.click();
    await expect(menu).toBeHidden();

    // Escape closes it and returns focus to the toggle.
    await button.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("no horizontal scroll at 375px, with and without the menu open @mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    const button = page.getByTestId("landing-mobile-menu-button");
    await waitForHydration(button);
    await button.click();
    await expect(page.getByTestId("landing-mobile-menu")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
