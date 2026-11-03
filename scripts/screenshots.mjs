#!/usr/bin/env node
/**
 * Captures README screenshots (1440x900 PNG) into docs/screenshots/.
 *
 *   npm run seed:demo        # on a fresh instance
 *   npm run screenshots
 *
 * Env: BASE_URL (default http://localhost:3000), DEMO_USER (default "dilnoza"),
 * DEMO_PASSWORD (default "credzo-demo-2026").
 * Over plain HTTP the server must run with COOKIE_SECURE=false (or in dev mode).
 * Needs Chromium: npx playwright install chromium
 */
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const DEMO_USER = process.env.DEMO_USER ?? "dilnoza";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "credzo-demo-2026";
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "screenshots");
const VIEWPORT = { width: 1440, height: 900 };
const LOADING_SELECTOR = '[data-skeleton], .animate-pulse, [aria-busy="true"]';

async function newContext(browser, theme) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: "reduce",
  });
  await context.addInitScript((value) => {
    try {
      window.localStorage.setItem("theme", value);
    } catch {
      // Storage can be unavailable on error pages; the theme then follows colorScheme.
    }
  }, theme);
  return context;
}

async function login(context) {
  const res = await context.request.post("/api/auth/login", {
    data: { username: DEMO_USER, password: DEMO_PASSWORD },
    headers: { Origin: new URL(BASE_URL).origin },
  });
  if (!res.ok()) {
    throw new Error(`Login as "${DEMO_USER}" failed (${res.status()}). Run "npm run seed:demo" first.`);
  }
}

async function apiData(context, url) {
  const res = await context.request.get(url);
  if (!res.ok()) throw new Error(`GET ${url} failed (${res.status()})`);
  const body = await res.json();
  return body.data;
}

async function capture(page, name, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction((sel) => !document.querySelector(sel), LOADING_SELECTOR, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  const tmp = path.join(OUT_DIR, `${name}.png.tmp`);
  await page.screenshot({ path: tmp, type: "png" });
  await rename(tmp, path.join(OUT_DIR, `${name}.png`));
  process.stdout.write(`  ${name}.png  <- ${url}\n`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    process.stdout.write(`Capturing ${BASE_URL} into ${path.relative(process.cwd(), OUT_DIR)}/\n`);

    const anon = await newContext(browser, "light");
    const anonPage = await anon.newPage();
    await capture(anonPage, "landing", "/");
    await capture(anonPage, "login", "/login");
    await anon.close();

    const light = await newContext(browser, "light");
    await login(light);
    const projects = await apiData(light, "/api/projects");
    if (!Array.isArray(projects) || projects.length === 0) {
      throw new Error('No projects visible to the demo user. Run "npm run seed:demo" first.');
    }
    const project = projects.find((p) => p.name === "Payments API") ?? projects[0];
    const detail = await apiData(light, `/api/projects/${project.id}`);
    const credential = detail?.credentials?.[0];

    const page = await light.newPage();
    const shots = [
      ["dashboard", "/dashboard"],
      ["projects", "/dashboard/projects"],
      ["project-detail", `/dashboard/projects/${project.id}`],
      ...(credential ? [["credential-detail", `/dashboard/projects/${project.id}/credentials/${credential.id}`]] : []),
      ["generator", "/dashboard/generator"],
      ["settings", "/dashboard/settings"],
      ["admin", "/dashboard/admin"],
      ["members", "/dashboard/members"],
      ["audit", "/dashboard/audit"],
    ];
    for (const [name, url] of shots) await capture(page, name, url);
    await light.close();

    const dark = await newContext(browser, "dark");
    await login(dark);
    await capture(await dark.newPage(), "dashboard-dark", "/dashboard");
    await dark.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`screenshots failed: ${error.message}\n`);
  process.exit(1);
});
