import { z } from "zod";

export const KINDS = ["kick", "clap", "hat", "bass", "keys", "pad"];
export const KEYS = ["D minor", "A minor", "C minor", "E minor", "G minor"];
export const SOUNDS = [
  {
    id: "kick",
    name: "Analog kick",
    label: "Kick",
    group: "Drums",
    color: "#ef8970",
    description: "Round low end. A little attitude.",
  },
  {
    id: "clap",
    name: "Soft clap",
    label: "Clap",
    group: "Drums",
    color: "#d8bd72",
    description: "Dry, soft-edged analog percussion.",
  },
  {
    id: "hat",
    name: "Dusty hats",
    label: "Hi-hat",
    group: "Drums",
    color: "#88bca4",
    description: "Air and movement between the beats.",
  },
  {
    id: "bass",
    name: "Sub bass",
    label: "Bass",
    group: "Synths",
    color: "#8fa9e4",
    description: "A warm foundation below the surface.",
  },
  {
    id: "keys",
    name: "Glass keys",
    label: "Keys",
    group: "Synths",
    color: "#baa0dc",
    description: "Bell-like keys with a soft shimmer.",
  },
  {
    id: "pad",
    name: "Air pad",
    label: "Pad",
    group: "Synths",
    color: "#7dbac0",
    description: "A slow-moving bed of analog chords.",
  },
];
const finite = z.number().finite();
export const trackPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    level: finite.min(-48).max(6).optional(),
    pan: finite.min(-1).max(1).optional(),
    tone: finite.min(0).max(100).optional(),
    decay: finite.min(30).max(2000).optional(),
    mute: z.boolean().optional(),
    solo: z.boolean().optional(),
  })
  .strict();
export const trackSchema = trackPatchSchema.required().extend({
  id: z.enum(KINDS),
  kind: z.enum(KINDS),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  steps: z.array(finite.min(0).max(1)).length(64),
  notes: z.array(z.number().int().min(24).max(96)).length(64),
});
export const sessionPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    tempo: z.number().int().min(40).max(240).optional(),
    key: z.enum(KEYS).optional(),
    bars: z.number().int().min(1).max(4).optional(),
    swing: finite.min(0).max(60).optional(),
    master: finite.min(-48).max(0).optional(),
    loop: z.boolean().optional(),
  })
  .strict();
export const sessionSchema = sessionPatchSchema
  .required()
  .extend({
    schemaVersion: z.literal(1),
    tracks: z.array(trackSchema).length(6),
  })
  .superRefine((s, ctx) => {
    if (
      new Set(s.tracks.map((t) => t.id)).size !== 6 ||
      s.tracks.some((t) => t.id !== t.kind)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Each of the six instruments must occur exactly once, with a matching id and kind.",
      });
  });
const trackId = z.enum(KINDS);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session"), patch: sessionPatchSchema }).strict(),
  z
    .object({ type: z.literal("track"), trackId, patch: trackPatchSchema })
    .strict(),
  z
    .object({
      type: z.literal("step"),
      trackId,
      index: z.number().int().min(0).max(63),
      velocity: finite.min(0).max(1),
      note: z.number().int().min(24).max(96).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("pattern"),
      trackId,
      bar: z.number().int().min(0).max(3),
      steps: z.array(finite.min(0).max(1)).length(16),
      notes: z.array(z.number().int().min(24).max(96)).length(16).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("preset"),
      preset: z.enum(["midnight", "daybreak", "empty"]),
    })
    .strict(),
  z.object({ type: z.literal("replace"), session: sessionSchema }).strict(),
  z.object({ type: z.literal("undo") }).strict(),
  z.object({ type: z.literal("redo") }).strict(),
]);

export function createSession(preset = "midnight") {
  const roots = [38, 34, 41, 36];
  const patterns = {
    kick: [0, 4, 8, 12, 14],
    clap: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14, 15],
    bass: [0, 6, 10],
    keys: [2, 5, 8, 11, 14],
    pad: [0],
  };
  const levels = [-8, -13, -21, -12, -19, -25];
  const decays = [180, 140, 65, 350, 650, 1800];
  const tracks = SOUNDS.map((s, ti) => ({
    id: s.id,
    kind: s.id,
    name: s.name,
    color: s.color,
    level: levels[ti],
    pan: [0, 0.08, -0.2, 0, 0.24, -0.15][ti],
    tone: [72, 65, 85, 40, 62, 35][ti],
    decay: decays[ti],
    mute: false,
    solo: false,
    steps: Array.from({ length: 64 }, (_, i) =>
      preset === "empty"
        ? 0
        : patterns[s.id].includes(i % 16)
          ? s.id === "hat"
            ? i % 4 === 0
              ? 0.7
              : 0.42
            : s.id === "kick" && i % 16 === 14
              ? 0.48
              : 0.85
          : 0,
    ),
    notes: Array.from(
      { length: 64 },
      (_, i) => s.id === "keys"
        ? [[62,65,69,72],[62,65,70,74],[60,65,69,72],[60,64,67,70]][Math.floor(i/16)][Math.floor((i%16)/4)]
        : roots[Math.floor(i / 16)] + (s.id === "pad" ? 12 : 0),
    ),
  }));
  if (preset === "daybreak") {
    tracks[0].steps = tracks[0].steps.map((_, i) => (i % 4 === 0 ? 0.9 : 0));
    tracks[2].steps = tracks[2].steps.map((_, i) => (i % 2 ? 0.55 : 0));
    tracks[3].steps = tracks[3].steps.map((_, i) => (i % 4 === 2 ? 0.8 : 0));
  }
  return sessionSchema.parse({
    schemaVersion: 1,
    name:
      preset === "empty"
        ? "Untitled session"
        : preset === "daybreak"
          ? "Daybreak drive"
          : "Midnight signal",
    tempo: preset === "daybreak" ? 124 : 108,
    key: "D minor",
    bars: 4,
    swing: preset === "daybreak" ? 0 : 12,
    master: -6,
    loop: true,
    tracks,
  });
}

export function applyCommand(session, raw) {
  const command = commandSchema.parse(raw);
  if (command.type === "preset") return createSession(command.preset);
  if (command.type === "replace") return structuredClone(command.session);
  if (command.type === "undo" || command.type === "redo")
    throw new Error("History commands belong to the session store.");
  const next = structuredClone(session);
  if (command.type === "session") Object.assign(next, command.patch);
  else {
    const track = next.tracks.find((t) => t.id === command.trackId);
    if (!track) throw new Error("Instrument not found.");
    if (command.type === "track") Object.assign(track, command.patch);
    if (command.type === "step") {
      track.steps[command.index] = command.velocity;
      if (command.note !== undefined) track.notes[command.index] = command.note;
    }
    if (command.type === "pattern") {
      track.steps.splice(command.bar * 16, 16, ...command.steps);
      if (command.notes)
        track.notes.splice(command.bar * 16, 16, ...command.notes);
    }
  }
  return sessionSchema.parse(next);
}

export function isAudible(track, tracks) {
  return !track.mute && (!tracks.some((t) => t.solo) || track.solo);
}
export function stepSeconds(tempo) {
  return 60 / tempo / 4;
}
export function stepTime(index, tempo, swing) {
  return (
    index * stepSeconds(tempo) +
    (index % 2 ? (stepSeconds(tempo) * swing) / 100 : 0)
  );
}
export function midiName(note) {
  return (
    ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"][
      note % 12
    ] +
    (Math.floor(note / 12) - 1)
  );
}
export function keyOffset(key) {
  return (
    { "D minor": 0, "A minor": -5, "C minor": -2, "E minor": 2, "G minor": 5 }[
      key
    ] ?? 0
  );
}
