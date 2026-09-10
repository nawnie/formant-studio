import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createSession,
  applyCommand,
  sessionSchema,
  isAudible,
  stepTime,
  stepSeconds,
} from "../shared/session.mjs";
import { SessionStore } from "../server/store.mjs";

test("all starter sessions conform to the portable schema", () => {
  for (const preset of ["midnight", "daybreak", "empty"])
    assert.equal(sessionSchema.parse(createSession(preset)).tracks.length, 6);
  assert.ok(
    createSession("empty").tracks.every((t) => t.steps.every((v) => v === 0)),
  );
});
test("edits change only the targeted instrument and bar; original remains intact", () => {
  const original = createSession();
  const next = applyCommand(original, {
    type: "pattern",
    trackId: "bass",
    bar: 2,
    steps: Array(16).fill(0.5),
    notes: Array(16).fill(48),
  });
  assert.deepEqual(next.tracks[3].steps.slice(32, 48), Array(16).fill(0.5));
  assert.deepEqual(
    next.tracks[3].steps.slice(0, 32),
    original.tracks[3].steps.slice(0, 32),
  );
  assert.deepEqual(next.tracks[0], original.tracks[0]);
  assert.notDeepEqual(next.tracks[3], original.tracks[3]);
});
test("invalid lengths, bounds, non-finite values and unknown properties are rejected", () => {
  const session = createSession();
  for (const command of [
    { type: "session", patch: { tempo: 0 } },
    { type: "session", patch: { master: 6 } },
    { type: "track", trackId: "kick", patch: { pan: 2 } },
    { type: "track", trackId: "kick", patch: { level: NaN } },
    { type: "pattern", trackId: "kick", bar: 0, steps: [1] },
    { type: "step", trackId: "kick", index: 64, velocity: 1 },
    { type: "step", trackId: "kick", index: 0, velocity: 1.1 },
    { type: "session", patch: { command: "shell" } },
  ])
    assert.throws(() => applyCommand(session, command));
});
test("import rejects duplicate instrument identities", () => {
  const session = createSession();
  session.tracks[5] = structuredClone(session.tracks[0]);
  assert.throws(() => sessionSchema.parse(session));
});
test("mute wins over solo and non-soloed tracks are suppressed", () => {
  const tracks = createSession().tracks;
  tracks[1].solo = true;
  assert.equal(isAudible(tracks[0], tracks), false);
  assert.equal(isAudible(tracks[1], tracks), true);
  tracks[1].mute = true;
  assert.equal(isAudible(tracks[1], tracks), false);
});
test("swing shifts only offbeats and preserves bar duration across tempo range", () => {
  for (const tempo of [40, 108, 240]) {
    const interval = stepSeconds(tempo);
    assert.equal(stepTime(2, tempo, 60), interval * 2);
    assert.ok(Math.abs(stepTime(1, tempo, 60) - interval * 1.6) < 1e-9);
    assert.equal(stepTime(16, tempo, 60), 240 / tempo);
    for (let i = 1; i < 64; i++)
      assert.ok(stepTime(i, tempo, 60) > stepTime(i - 1, tempo, 60));
  }
});
test("concurrent mutations serialize, persist, survive reopen, and undo/redo correctly", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formant-store-"));
  const store = await new SessionStore(directory).init();
  await Promise.all([
    store.execute({ type: "session", patch: { tempo: 117 } }),
    store.execute({ type: "step", trackId: "kick", index: 1, velocity: 0.66 }),
    store.execute({ type: "track", trackId: "pad", patch: { pan: -0.5 } }),
  ]);
  assert.equal(store.revision, 3);
  assert.equal(store.session.tempo, 117);
  assert.equal(store.session.tracks[0].steps[1], 0.66);
  assert.equal(store.session.tracks[5].pan, -0.5);
  const reopened = await new SessionStore(directory).init();
  assert.deepEqual(reopened.session, store.session);
  await store.execute({ type: "undo" });
  assert.equal(store.session.tracks[5].pan, -0.15);
  await store.execute({ type: "redo" });
  assert.equal(store.session.tracks[5].pan, -0.5);
  await store.execute({ type: "undo" });
  await store.execute({ type: "session", patch: { name: "Fresh take" } });
  assert.equal(store.snapshot().canRedo, false);
  assert.equal(
    JSON.parse(await readFile(path.join(directory, "session.json"), "utf8"))
      .name,
    "Fresh take",
  );
});
test("corrupt persisted sessions are preserved and fail closed", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formant-corrupt-")),
    file = path.join(directory, "session.json");
  await writeFile(file, "not JSON");
  await assert.rejects(new SessionStore(directory).init(), /preserved/);
  assert.equal(await readFile(file, "utf8"), "not JSON");
});
test("a rejected edit does not poison later persistence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formant-recovery-")),
    store = await new SessionStore(directory).init();
  await assert.rejects(
    store.execute({ type: "session", patch: { tempo: 1000 } }),
  );
  await store.execute({ type: "session", patch: { tempo: 99 } });
  assert.equal(store.session.tempo, 99);
  assert.equal(store.revision, 1);
});
