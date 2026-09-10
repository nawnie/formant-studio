import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  KINDS,
  trackPatchSchema,
  sessionPatchSchema,
} from "../shared/session.mjs";

const base = new URL(process.env.FORMANT_URL || "http://127.0.0.1:4317");
if (
  base.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
  base.username ||
  base.password
)
  throw new Error("FORMANT_URL must point to the local FORMANT service.");
async function api(endpoint, payload) {
  const response = await fetch(new URL(endpoint, base), {
    method: payload === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
const server = new McpServer({ name: "formant-studio", version: "1.0.0" });
const out = (data) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});
const register = (name, description, schema, handler, readOnly = false) =>
  server.registerTool(
    name,
    {
      description,
      inputSchema: schema,
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        return out(await handler(args));
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `FORMANT: ${error.message}` }],
        };
      }
    },
  );
register(
  "formant_get_session",
  "Read the actual saved session, revision, undo availability, and browser audio runtime. Verify transport with runtime.playing; a delivered request is not playback proof.",
  {},
  () => api("/api/session"),
  true,
);
register(
  "formant_set_session",
  "Set tempo (40–240 BPM), D/A/C/E/G minor key, 1–4 bar length, swing (0–60%), master (-48–0 dB), loop, or name. Edits autosave and are undoable.",
  { patch: sessionPatchSchema },
  (args) => api("/api/command", { type: "session", ...args }),
);
register(
  "formant_set_track",
  "Shape one built-in synthesized instrument. Level is dB, pan is -1 left to +1 right, tone is 0–100%, decay is 30–2000 ms. Mute takes precedence over solo.",
  { trackId: z.enum(KINDS), patch: trackPatchSchema },
  (args) => api("/api/command", { type: "track", ...args }),
);
register(
  "formant_set_pattern",
  "Replace one bar of a track with exactly 16 velocity values (0 is off, 0–1 on). Bars are zero-based 0–3. Optional MIDI notes are 24–96, based in D minor and transposed by the session key. All bars remain editable; only session.bars are played.",
  {
    trackId: z.enum(KINDS),
    bar: z.number().int().min(0).max(3),
    steps: z.array(z.number().min(0).max(1)).length(16),
    notes: z.array(z.number().int().min(24).max(96)).length(16).optional(),
  },
  (args) => api("/api/command", { type: "pattern", ...args }),
);
register(
  "formant_set_step",
  "Set an individual sixteenth-note event using index 0–63 and velocity 0–1. Optional MIDI note 24–96.",
  {
    trackId: z.enum(KINDS),
    index: z.number().int().min(0).max(63),
    velocity: z.number().min(0).max(1),
    note: z.number().int().min(24).max(96).optional(),
  },
  (args) => api("/api/command", { type: "step", ...args }),
);
register(
  "formant_transport",
  "Request play, pause, or stop in the active browser. A person must click Play once to unlock Web Audio. Read formant_get_session afterward for actual runtime confirmation. Pause keeps the position; stop returns to the beginning.",
  { action: z.enum(["play", "pause", "stop"]) },
  (args) => api("/api/transport", args),
);
register(
  "formant_load_preset",
  "Load a synthesized starter: midnight (108 BPM), daybreak (124 BPM), or empty. Undo restores the previous session.",
  { preset: z.enum(["midnight", "daybreak", "empty"]) },
  (args) => api("/api/command", { type: "preset", ...args }),
);
register(
  "formant_history",
  "Undo or redo one of the last 100 session edits. History is kept for this service lifetime; the current session persists across restarts.",
  { action: z.enum(["undo", "redo"]) },
  (args) => api("/api/command", { type: args.action }),
);
register(
  "formant_export_audio",
  "Render the saved loop plus a two-second release tail as 48 kHz stereo 16-bit PCM WAV using the connected browser OfflineAudioContext. Waits up to 35 seconds, returning a verified local output file or a pending job ID. Does not require speakers or a cloud model.",
  {},
  async () => {
    let job = await api("/api/export", {});
    const deadline = Date.now() + 35000;
    while (job.status === "pending" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      job = await api(`/api/jobs/${job.id}`);
    }
    if (job.status === "failed") throw new Error(job.error);
    return job;
  },
);
register(
  "formant_get_export",
  "Check an export job until status is completed or failed. Only a completed job has a saved WAV file.",
  { id: z.string().uuid() },
  ({ id }) => api(`/api/jobs/${id}`),
  true,
);
server.registerResource(
  "session",
  "formant://session",
  { title: "Current FORMANT session", mimeType: "application/json" },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await api("/api/session"), null, 2),
      },
    ],
  }),
);
server.registerPrompt(
  "produce_loop",
  {
    title: "Produce a loop in FORMANT",
    description: "A grounded workflow for composing with the current session.",
    argsSchema: { direction: z.string() },
  },
  ({ direction }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Use FORMANT to develop this musical direction: ${direction}. First read the actual session. Use the six synthesized instruments, 16 steps per bar, and 1–4 bars. Make purposeful changes using patterns, notes and mix controls. Keep edits undoable. Read back the resulting session. Playback requires a user gesture in the browser; state clearly if audio is suspended. Export only if requested, and distinguish a pending job from a completed WAV.`,
        },
      },
    ],
  }),
);
await server.connect(new StdioServerTransport());
