import { spawn } from "node:child_process";
import { openSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url)),
  port = Number(process.env.FORMANT_PORT || 4317),
  url = `http://127.0.0.1:${port}`;
if (!existsSync(path.join(root, "dist", "index.html")))
  throw new Error(
    "Run npm ci and npm run build inside FORMANT before launching.",
  );
let ready = false;
try {
  const response = await fetch(`${url}/api/health`, {
    signal: AbortSignal.timeout(1500),
  });
  const health = await response.json();
  if (health.app !== "formant-studio")
    throw new Error("This port belongs to another application.");
  ready = true;
} catch (error) {
  if (error.message === "This port belongs to another application.")
    throw error;
}
if (!ready) {
  mkdirSync(path.join(root, ".formant"), { recursive: true });
  const log = openSync(path.join(root, ".formant", "launch.log"), "a");
  const child = spawn(
    process.execPath,
    [path.join(root, "server", "http.mjs")],
    {
      cwd: root,
      env: { ...process.env, FORMANT_PORT: String(port) },
      detached: true,
      windowsHide: true,
      stdio: ["ignore", log, log],
    },
  );
  child.unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const health = await (
        await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) })
      ).json();
      if (health.app === "formant-studio") {
        ready = true;
        break;
      }
    } catch {}
  }
  if (!ready)
    throw new Error(
      "FORMANT did not start. Inspect .formant/launch.log; another app may own the port.",
    );
}
console.log(`FORMANT is ready: ${url}`);
if (!process.argv.includes("--no-open")) {
  const command =
    process.platform === "win32"
      ? "explorer.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const child = spawn(command, [url], {
    detached: true,
    windowsHide: true,
    stdio: "ignore",
  });
  child.on("error", () => console.error(`Open ${url} in your browser.`));
  child.unref();
}
