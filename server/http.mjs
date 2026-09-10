import http from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SessionStore } from "./store.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.FORMANT_PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid FORMANT_PORT.");
const url = `http://127.0.0.1:${port}`;
const dataDir = process.env.FORMANT_DATA_DIR
  ? path.resolve(process.env.FORMANT_DATA_DIR)
  : path.join(root, ".formant");
const store = await new SessionStore(dataDir).init();
const clients = new Map(),
  jobs = new Map();
let audioOwner = null;
const development = process.argv.includes("--dev");
const vite = development
  ? await (
      await import("vite")
    ).createServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    })
  : null;
function send(res, code, value) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}
function broadcast(type, value) {
  for (const client of clients.values())
    client.res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`);
}
function runtime() {
  return [...clients.entries()].map(([id, c]) => ({
    id,
    ...c.runtime,
    owner: id === audioOwner,
  }));
}
async function body(req, max = 1_000_000, binary = false) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  return binary ? buffer : JSON.parse(buffer.toString("utf8") || "{}");
}
function activeClient() {
  if (audioOwner && clients.has(audioOwner)) return audioOwner;
  return clients.keys().next().value;
}
function direct(clientId, type, value) {
  clients
    .get(clientId)
    ?.res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!allowedHosts.includes(req.headers.host))
    return send(res, 403, { error: "Local connections only." });
  if (
    req.headers.origin &&
    ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(
      req.headers.origin,
    )
  )
    return send(res, 403, {
      error: "Cross-origin requests are not permitted.",
    });
  if (req.headers["sec-fetch-site"] === "cross-site")
    return send(res, 403, { error: "Cross-site requests are not permitted." });
  const requestUrl = new URL(req.url, url),
    pathname = requestUrl.pathname;
  try {
    if (req.method === "GET" && pathname === "/api/health")
      return send(res, 200, { app: "formant-studio", version: "1.0.0", url });
    if (req.method === "GET" && pathname === "/api/info")
      return send(res, 200, {
        url,
        mcp: {
          mcpServers: {
            formant: {
              command: process.execPath,
              args: [path.join(root, "server", "mcp.mjs")],
              env: { FORMANT_URL: url },
            },
          },
        },
        runtime: runtime(),
        exportDirectory: path.join(dataDir, "exports"),
      });
    if (req.method === "GET" && pathname === "/api/session")
      return send(res, 200, { ...store.snapshot(), runtime: runtime() });
    if (req.method === "GET" && pathname === "/api/events") {
      const id = requestUrl.searchParams.get("client");
      if (
        !id ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
        clients.size >= 8 ||
        clients.has(id)
      )
        return send(res, 400, {
          error: "Invalid or duplicate browser connection.",
        });
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      clients.set(id, {
        res,
        runtime: {
          audioState: "suspended",
          playing: false,
          sampleRate: null,
          lastSeen: Date.now(),
        },
      });
      direct(id, "session", store.snapshot());
      req.on("close", () => {
        clients.delete(id);
        if (audioOwner === id) audioOwner = null;
      });
      return;
    }
    if (
      req.method === "POST" &&
      pathname.startsWith("/api/jobs/") &&
      pathname.endsWith("/audio")
    ) {
      const id = pathname.split("/")[3],
        job = jobs.get(id);
      if (!job || job.status !== "pending")
        return send(res, 404, { error: "Export job is not pending." });
      if (req.headers["x-formant-client"] !== job.clientId)
        return send(res, 403, { error: "Export belongs to another browser." });
      const wav = await body(req, 14_000_000, true);
      if (
        wav.length < 44 ||
        wav.toString("ascii", 0, 4) !== "RIFF" ||
        wav.toString("ascii", 8, 12) !== "WAVE" ||
        wav.readUInt32LE(4) + 8 !== wav.length
      )
        throw new Error("Expected a complete RIFF WAVE file.");
      const exportsDir = path.join(dataDir, "exports");
      await mkdir(exportsDir, { recursive: true });
      const output = path.join(exportsDir, `formant-${id}.wav`);
      await writeFile(output, wav);
      Object.assign(job, {
        status: "completed",
        path: output,
        bytes: wav.length,
        completedAt: new Date().toISOString(),
      });
      broadcast("job", job);
      return send(res, 200, job);
    }
    if (req.method === "POST") {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { error: "Use application/json." });
      const payload = await body(req);
      if (pathname === "/api/command") {
        const snapshot = await store.execute(payload);
        broadcast("session", snapshot);
        return send(res, 200, snapshot);
      }
      if (pathname === "/api/runtime") {
        const value = z
          .object({
            id: z.string(),
            audioState: z.enum(["suspended", "running", "closed"]),
            playing: z.boolean(),
            sampleRate: z.number().nullable(),
            peak: z.number().optional(),
          })
          .parse(payload);
        const client = clients.get(value.id);
        if (!client)
          return send(res, 409, { error: "Browser connection expired." });
        client.runtime = { ...value, lastSeen: Date.now() };
        return send(res, 200, { ok: true });
      }
      if (pathname === "/api/transport") {
        const { action, clientId } = z
          .object({
            action: z.enum(["play", "pause", "stop"]),
            clientId: z.string().optional(),
          })
          .parse(payload);
        const target =
          clientId && clients.has(clientId) ? clientId : activeClient();
        if (!target)
          return send(res, 409, { error: "Open FORMANT in a browser first." });
        if (
          action === "play" &&
          clients.get(target).runtime.audioState !== "running"
        )
          return send(res, 409, {
            error:
              "Click Play in FORMANT once to enable browser audio, then retry.",
          });
        if (action === "play") {
          if (audioOwner && audioOwner !== target)
            direct(audioOwner, "transport", { action: "stop" });
          audioOwner = target;
        }
        direct(target, "transport", { action });
        return send(res, 200, {
          requested: action,
          clientId: target,
          runtime: clients.get(target).runtime,
          note: "Request delivered; read session runtime for browser confirmation.",
        });
      }
      if (pathname === "/api/export") {
        const { clientId } = z
          .object({ clientId: z.string().optional() })
          .parse(payload);
        const target =
          clientId && clients.has(clientId) ? clientId : activeClient();
        if (!target)
          return send(res, 409, {
            error: "Open FORMANT in a browser to render audio.",
          });
        if ([...jobs.values()].some((j) => j.status === "pending"))
          return send(res, 409, { error: "An export is already in progress." });
        const job = {
          id: randomUUID(),
          status: "pending",
          clientId: target,
          createdAt: new Date().toISOString(),
          revision: store.revision,
        };
        if (jobs.size >= 40) jobs.delete(jobs.keys().next().value);
        jobs.set(job.id, job);
        direct(target, "export", { job, session: store.snapshot().session });
        return send(res, 202, job);
      }
      if (pathname === "/api/job-failed") {
        const value = z
          .object({
            id: z.string(),
            clientId: z.string(),
            error: z.string().max(300),
          })
          .parse(payload);
        const job = jobs.get(value.id);
        if (!job || job.clientId !== value.clientId)
          return send(res, 404, { error: "Unknown export." });
        Object.assign(job, { status: "failed", error: value.error });
        broadcast("job", job);
        return send(res, 200, job);
      }
      if (pathname === "/api/shutdown") {
        send(res, 200, { stopping: true });
        setTimeout(() => process.exit(0), 150);
        return;
      }
    }
    if (req.method === "GET" && pathname.startsWith("/api/jobs/")) {
      const job = jobs.get(pathname.split("/")[3]);
      return send(res, job ? 200 : 404, job || { error: "Unknown export." });
    }
    if (pathname.startsWith("/api/"))
      return send(res, 404, { error: "Endpoint not found." });
    if (req.method !== "GET" && req.method !== "HEAD")
      return send(res, 405, { error: "Method not allowed." });
    if (vite) return vite.middlewares(req, res);
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    const dist = path.join(root, "dist");
    const file = path.resolve(
      dist,
      "." + decodeURIComponent(pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(dist + path.sep))
      return send(res, 403, { error: "Invalid path." });
    try {
      const content = await readFile(file);
      const type =
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
          ".woff": "font/woff",
          ".png": "image/png",
        }[path.extname(file)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      send(res, 404, {
        error: file.endsWith("index.html")
          ? "Build FORMANT first with npm run build."
          : "File not found.",
      });
    }
  } catch (error) {
    send(res, 400, {
      error:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : error.message,
    });
  }
});
const heartbeat = setInterval(() => {
  for (const c of clients.values()) c.res.write(": heartbeat\n\n");
  for (const job of jobs.values())
    if (
      job.status === "pending" &&
      Date.now() - Date.parse(job.createdAt) > 45000
    ) {
      Object.assign(job, {
        status: "failed",
        error: "Browser did not finish rendering within 45 seconds.",
      });
      broadcast("job", job);
    }
}, 10000);
heartbeat.unref();
server.on("error", (error) => {
  console.error(
    `FORMANT could not bind ${url}: ${error.message}. Existing listeners were left alone.`,
  );
  process.exitCode = 1;
  clearInterval(heartbeat);
  vite?.close();
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `FORMANT Studio 1.0.0 · ${url} · ${development ? "development" : "production"}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const c of clients.values()) c.res.end();
    server.close();
    vite?.close();
    clearInterval(heartbeat);
  });
