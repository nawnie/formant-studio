import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const root = fileURLToPath(new URL("../", import.meta.url)),
  dir = path.join(root, "docs", "reviews"),
  pass = process.argv[2] || "2";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.FORMANT_BROWSER_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1536, height: 1024 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const receipts = [];
async function ready() {
  await page.goto("http://127.0.0.1:4317");
  await page.getByText("All changes saved locally", { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(name, fullPage = false) {
  await page.screenshot({
    path: path.join(dir, `pass-${pass}-${name}.png`),
    fullPage,
  });
  receipts.push({
    name,
    ...(await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      editorCount: document.querySelectorAll(".pattern-editor").length,
    }))),
  });
}
try {
  await ready();
  await capture("desktop");
  const desktopAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  receipts.push({
    name: "desktop-accessibility",
    violations: desktopAxe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  await page.getByRole("tab", { name: "Mixer", exact: true }).click();
  await capture("mixer");
  await page
    .getByRole("button", { name: "AI connection", exact: true })
    .click();
  await capture("ai");
  const aiAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  receipts.push({
    name: "ai-accessibility",
    violations: aiAxe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready();
  await capture("laptop");
  await page.setViewportSize({ width: 390, height: 844 });
  await ready();
  await capture("mobile-top");
  await capture("mobile-full", true);
  const mobileAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  receipts.push({
    name: "mobile-accessibility",
    violations: mobileAxe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  await page
    .getByRole("button", { name: "AI connection", exact: true })
    .click();
  await capture("mobile-ai");
  receipts.push({ name: "browser-errors", errors });
  await writeFile(
    path.join(dir, `pass-${pass}-measurements.json`),
    JSON.stringify(
      {
        engine: "Playwright Chromium, headless isolated context",
        fallbackReason:
          "In-app screenshot capture used incorrect crop/stitch dimensions under viewport overrides, duplicating rendered regions. IAB DOM and interaction evidence remains valid.",
        receipts,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        pass,
        captures: receipts.filter((x) => "width" in x),
        accessibility: receipts
          .filter((x) => x.violations)
          .map((x) => ({
            name: x.name,
            count: x.violations.length,
            ids: x.violations.map((v) => v.id),
          })),
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
