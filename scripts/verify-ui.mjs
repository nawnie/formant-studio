import { chromium } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url)),
  base = "http://127.0.0.1:4317";
const state = async () => (await fetch(`${base}/api/session`)).json();
const baseline = (await state()).session,
  receipts = [],
  errors = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.FORMANT_BROWSER_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1536, height: 1024 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, detail = {}) => {
  receipts.push({ name, passed: true, ...detail });
  console.log(`PASS ${name}`);
};
async function until(predicate) {
  for (let i = 0; i < 60; i++) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Expected state did not arrive.");
}
const client = new Client({ name: "formant-ui-verifier", version: "1.0.0" });
try {
  await page.goto(base);
  await page.getByText("All changes saved locally", { exact: true }).waitFor();
  assert.equal(await page.locator(".pattern-editor").count(), 1);
  const original = baseline.tracks[0].steps[1];
  await page
    .getByRole("button", {
      name: `Step 2, ${original ? "on" : "off"}`,
      exact: true,
    })
    .click();
  await until(
    async () =>
      (await state()).session.tracks[0].steps[1] > 0 === !Boolean(original),
  );
  await page
    .getByRole("button", { name: "Undo (Ctrl/⌘ Z)", exact: true })
    .click();
  await until(
    async () => (await state()).session.tracks[0].steps[1] === original,
  );
  check("Pad edit reaches saved session and undo restores it");

  await page
    .getByLabel("Find a sound", { exact: true })
    .fill("no matching instrument");
  await page.locator('.search-empty').waitFor();
  assert.ok((await page.locator('.search-empty').innerText()).includes('No matching sounds.'));
  await page
    .getByRole("button", { name: "Clear sound search", exact: true })
    .click();
  await page.getByRole("button", { name: "Synths", exact: true }).click();
  assert.equal(await page.locator(".sound-item").count(), 3);
  await page.getByRole("button", { name: "All", exact: true }).click();
  check("Sound search, empty state, reset and category filter");

  await page.getByLabel("Tempo BPM", { exact: true }).fill("116");
  await page.getByLabel("Tempo BPM", { exact: true }).press("Enter");
  await until(async () => (await state()).session.tempo === 116);
  await page.getByLabel("Tempo BPM", { exact: true }).fill("25");
  await page.getByLabel("Tempo BPM", { exact: true }).press("Enter");
  assert.equal((await state()).session.tempo, 116);
  check("Editable tempo commits valid input and rejects invalid range");

  await page
    .getByRole("button", { name: "Edit Glass keys", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit note & velocity", exact: true })
    .click();
  await page.getByLabel("Step note", { exact: true }).selectOption("65");
  await until(async () => (await state()).session.tracks[4].notes[0] === 65);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByLabel("Musical key", { exact: true }).selectOption("C minor");
  await until(async () => (await state()).session.key === "C minor");
  assert.equal(await page.locator(".step-pad").first().innerText(), "E♭4");
  check("Note editor writes actual MIDI and displays transposed sounding note");

  await page.getByRole("tab", { name: "Arrangement", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page
    .getByRole("tab", { name: "Mixer", exact: true, selected: true })
    .waitFor();
  await page.getByLabel("Mixer Sub bass level", { exact: true }).focus();
  await page.keyboard.press("ArrowUp");
  await until(
    async () =>
      (await state()).session.tracks[3].level !== baseline.tracks[3].level,
  );
  await page
    .getByRole("button", { name: "Solo Sub bass", exact: true })
    .click();
  await until(async () => (await state()).session.tracks[3].solo);
  await page
    .getByRole("button", { name: "Solo Sub bass", exact: true })
    .click();
  await until(async () => !(await state()).session.tracks[3].solo);
  check("Keyboard workspace tabs, accessible fader, solo and unsolo");

  await page.getByRole("button", { name: "Play session", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause playback", exact: true })
    .waitFor();
  await until(async () =>
    (await state()).runtime.some(
      (r) => r.owner && r.playing && r.audioState === "running",
    ),
  );
  await until(
    async () =>
      (await page.locator(".time-display").innerText()) !==
      "001 : 01 : 00\nBAR\nBEAT\nSTEP",
  );
  const live = (await state()).runtime.find((r) => r.owner);
  check("Real browser audio graph starts and transport advances", {
    sampleRate: live.sampleRate,
  });
  await page
    .getByRole("button", { name: "Stop and return to start", exact: true })
    .click();
  await until(async () => (await state()).runtime.every((r) => !r.playing));
  check("Stop silences transport and reports stopped runtime");

  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(root, "server", "mcp.mjs")],
      env: { ...process.env, FORMANT_URL: base },
      stderr: "pipe",
    }),
  );
  const result = await client.callTool({
    name: "formant_set_session",
    arguments: { patch: { tempo: 112 } },
  });
  assert.ok(!result.isError);
  await until(
    async () =>
      (await page.getByLabel("Tempo BPM", { exact: true }).inputValue()) ===
      "112",
  );
  check("A real MCP call visibly updates the open browser");
  const play = await client.callTool({
    name: "formant_transport",
    arguments: { action: "play" },
  });
  assert.ok(!play.isError);
  await until(async () =>
    (await state()).runtime.some((r) => r.owner && r.playing),
  );
  await client.callTool({
    name: "formant_transport",
    arguments: { action: "pause" },
  });
  await until(async () => (await state()).runtime.every((r) => !r.playing));
  check("MCP transport play and pause confirmed by browser runtime");

  await page.getByRole("button", { name: "Export audio", exact: true }).click();
  await page.getByRole("button", { name: "Render WAV", exact: true }).click();
  await page
    .getByRole("button", { name: "Download WAV", exact: true })
    .waitFor();
  await page.locator("audio").evaluate((el) => el.play());
  await until(
    async () =>
      await page.locator("audio").evaluate((el) => el.currentTime > 0.1),
  );
  await page.locator("audio").evaluate((el) => el.pause());
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download WAV", exact: true }).click();
  const wavDownload = await downloadPromise;
  const wav = await readFile(await wavDownload.path());
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), 48000);
  assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(wav.readUInt16LE(34), 16);
  let energy = 0,
    peak = 0;
  for (let i = 44; i < wav.length; i += 2) {
    const v = wav.readInt16LE(i) / 32768;
    energy += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  assert.ok(peak > 0.001 && peak < 1);
  await page.screenshot({
    path: path.join(root, "docs/reviews/export-preview.png"),
  });
  check(
    "Offline render, measured waveform, audible-file preview and WAV download",
    {
      bytes: wav.length,
      peak,
      rms: Math.sqrt(energy / ((wav.length - 44) / 2)),
    },
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();

  const projectDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const projectDownload = await projectDownloadPromise;
  const project = JSON.parse(
    await readFile(await projectDownload.path(), "utf8"),
  );
  assert.equal(project.tempo, 112);
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: /A blank canvas/ }).click();
  await until(async () => (await state()).session.name === "Untitled session");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByLabel("Open a FORMANT project file", { exact: true })
    .setInputFiles({
      name: "roundtrip.formant.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await until(async () => (await state()).session.name === project.name);
  assert.deepEqual((await state()).session, project);
  await page.reload();
  await page.getByText("All changes saved locally", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Tempo BPM", { exact: true }).inputValue(),
    "112",
  );
  check("Save, starter replacement, project import and reload round trip");

  await page.setViewportSize({ width: 390, height: 600 });
  await page.reload();
  await page.getByText("All changes saved locally", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "AI connection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Copy configuration", exact: true })
    .waitFor();
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("dialog")),
      ),
    );
  }
  const closeBox = await page
    .getByRole("button", { name: "Close dialog", exact: true })
    .boundingBox();
  assert.ok(closeBox.y >= 0 && closeBox.y + closeBox.height <= 600);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "AI connection",
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  check(
    "390×600 AI dialog close, focus containment, Escape and focus restoration",
  );
  assert.deepEqual(errors, []);
  check("No uncaught browser errors");
} finally {
  await client.close();
  await browser.close();
  await fetch(`${base}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "replace", session: baseline }),
  });
  await writeFile(
    path.join(root, "docs/reviews/ui-verification.json"),
    JSON.stringify({ at: new Date().toISOString(), receipts, errors }, null, 2),
  );
}
console.log(
  JSON.stringify(
    { passed: receipts.every((r) => r.passed), checks: receipts.length },
    null,
    2,
  ),
);
