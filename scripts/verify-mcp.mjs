import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url)),
  base = process.env.FORMANT_URL || "http://127.0.0.1:4317";
const receipts = [],
  client = new Client({ name: "formant-verifier", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "server", "mcp.mjs")],
  env: { ...process.env, FORMANT_URL: base },
  stderr: "pipe",
});
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text);
};
let baseline;
try {
  await client.connect(transport);
  receipts.push({
    check: "MCP initialize",
    passed: true,
    server: client.getServerVersion(),
  });
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 10);
  receipts.push({
    check: "MCP tools/list",
    passed: true,
    tools: tools.tools.map((t) => t.name),
  });
  baseline = (await call("formant_get_session")).session;
  let state = await call("formant_set_session", { patch: { tempo: 112 } });
  assert.equal(state.session.tempo, 112);
  const notes = Array(16).fill(38),
    steps = Array.from({ length: 16 }, (_, i) => (i % 4 === 2 ? 0.7 : 0));
  state = await call("formant_set_pattern", {
    trackId: "bass",
    bar: 0,
    steps,
    notes,
  });
  assert.deepEqual(state.session.tracks[3].steps.slice(0, 16), steps);
  state = await call("formant_set_track", {
    trackId: "hat",
    patch: { level: -24, pan: 0.3 },
  });
  assert.equal(state.session.tracks[2].level, -24);
  const invalid = await client.callTool({
    name: "formant_set_session",
    arguments: { patch: { tempo: 999 } },
  });
  assert.equal(invalid.isError, true);
  receipts.push({
    check: "Validated MCP edits and invalid input rejection",
    passed: true,
    revision: state.revision,
  });
  await call("formant_history", { action: "undo" });
  state = await call("formant_history", { action: "redo" });
  assert.equal(state.session.tracks[2].level, -24);
  const resource = await client.readResource({ uri: "formant://session" });
  assert.equal(JSON.parse(resource.contents[0].text).session.tempo, 112);
  const prompt = await client.getPrompt({
    name: "produce_loop",
    arguments: { direction: "sparse warm groove" },
  });
  assert.ok(prompt.messages[0].content.text.includes("sparse warm groove"));
  receipts.push({
    check: "MCP history, session resource and grounded prompt",
    passed: true,
  });
  if (process.argv.includes("--export")) {
    const job = await call("formant_export_audio");
    assert.equal(job.status, "completed");
    const wav = await readFile(job.path);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.readUInt32LE(24), 48000);
    assert.equal(wav.readUInt16LE(22), 2);
    let peak = 0,
      energy = 0,
      nonzero = 0;
    const count = (wav.length - 44) / 2;
    for (let i = 44; i < wav.length; i += 2) {
      const x = wav.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(x));
      energy += x * x;
      if (x !== 0) nonzero++;
    }
    assert.ok(peak > 0.001 && peak < 1);
    assert.ok(nonzero > 48000);
    receipts.push({
      check: "MCP browser render and PCM analysis",
      passed: true,
      path: job.path,
      bytes: wav.length,
      seconds: (wav.length - 44) / 192000,
      peak,
      rms: Math.sqrt(energy / count),
      nonzeroSamples: nonzero,
    });
  }
  const response = await fetch(`${base}/api/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
    body: JSON.stringify({
      type: "session",
      patch: { name: "should not apply" },
    }),
  });
  assert.equal(response.status, 403);
  receipts.push({
    check: "Cross-origin mutation rejected",
    passed: true,
    status: response.status,
  });
} finally {
  if (baseline)
    await fetch(`${base}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "replace", session: baseline }),
    });
  await client.close();
  await mkdir(path.join(root, "docs", "reviews"), { recursive: true });
  await writeFile(
    path.join(root, "docs", "reviews", "mcp-verification.json"),
    JSON.stringify({ at: new Date().toISOString(), receipts }, null, 2),
  );
}
console.log(
  JSON.stringify(
    {
      passed: receipts.every((r) => r.passed),
      checks: receipts.length,
      receipts,
    },
    null,
    2,
  ),
);
