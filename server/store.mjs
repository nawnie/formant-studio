import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import {
  applyCommand,
  createSession,
  sessionSchema,
  commandSchema,
} from "../shared/session.mjs";

export class SessionStore {
  constructor(directory) {
    this.directory = directory;
    this.session = createSession();
    this.revision = 0;
    this.history = [];
    this.future = [];
    this.queue = Promise.resolve();
  }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try {
      this.session = sessionSchema.parse(
        JSON.parse(
          await readFile(path.join(this.directory, "session.json"), "utf8"),
        ),
      );
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error(
          `Saved session is invalid; preserved at ${path.join(this.directory, "session.json")}. ${error.message}`,
        );
    }
    return this;
  }
  snapshot() {
    return {
      session: structuredClone(this.session),
      revision: this.revision,
      canUndo: this.history.length > 0,
      canRedo: this.future.length > 0,
    };
  }
  execute(raw) {
    const result = this.queue.then(async () => {
      const command = commandSchema.parse(raw);
      const history = [...this.history],
        future = [...this.future];
      let next;
      if (command.type === "undo") {
        if (!history.length) throw new Error("Nothing to undo.");
        next = history.pop();
        future.push(this.session);
      } else if (command.type === "redo") {
        if (!future.length) throw new Error("Nothing to redo.");
        next = future.pop();
        history.push(this.session);
      } else {
        next = applyCommand(this.session, command);
        history.push(this.session);
        future.length = 0;
      }
      const tmp = path.join(this.directory, "session.tmp");
      await writeFile(tmp, JSON.stringify(next, null, 2));
      await rename(tmp, path.join(this.directory, "session.json"));
      this.session = next;
      this.history = history.slice(-100);
      this.future = future.slice(-100);
      this.revision++;
      return this.snapshot();
    });
    this.queue = result.catch(() => {});
    return result;
  }
}
