import { useState } from "react";
import type { CSSProperties } from "react";
import { Copy, SlidersHorizontal, Undo2, Redo2 } from "lucide-react";
import { midiName, keyOffset } from "../../shared/session.mjs";
import type { Track } from "../types";
import type { Studio } from "../lib/useStudio";
import { IconButton, Knob, Modal } from "./Controls";
export function PatternEditor({
  studio,
  track,
  bar,
  setBar,
}: {
  studio: Studio;
  track: Track;
  bar: number;
  setBar: (bar: number) => void;
}) {
  const [editStep, setEditStep] = useState<number | null>(null);
  const values = track.steps.slice(bar * 16, bar * 16 + 16);
  const melodic = ["bass", "keys", "pad"].includes(track.kind);
  const updateTrack = (patch: Record<string, number>) =>
    void studio.command({ type: "track", trackId: track.id, patch });
  return (
    <section
      className="pattern-editor"
      aria-label="Pattern editor"
      style={{ "--track-color": track.color } as CSSProperties}
    >
      <div className="editor-heading">
        <h2>Pattern editor</h2>
        <span className="instrument-chip">{track.name}</span>
        <span className="editor-hint">Click a step to shape your rhythm.</span>
        <div className="editor-actions">
          <span className="mobile-history">
            <IconButton
              label="Undo edit"
              disabled={!studio.canUndo || studio.saving}
              onClick={() => void studio.command({ type: "undo" })}
            >
              <Undo2 size={15} />
            </IconButton>
            <IconButton
              label="Redo edit"
              disabled={!studio.canRedo || studio.saving}
              onClick={() => void studio.command({ type: "redo" })}
            >
              <Redo2 size={15} />
            </IconButton>
          </span>
          <IconButton
            label="Copy current pattern to all bars"
            onClick={() => {
              for (let b = 0; b < studio.session.bars; b++)
                if (b !== bar)
                  void studio.command({
                    type: "pattern",
                    trackId: track.id,
                    bar: b,
                    steps: values,
                    notes: track.notes.slice(bar * 16, bar * 16 + 16),
                  });
              studio.notify("Pattern copied to all bars.");
            }}
          >
            <Copy size={15} />
          </IconButton>
          <button
            className="button small"
            onClick={() =>
              void studio.command({
                type: "pattern",
                trackId: track.id,
                bar,
                steps: Array(16).fill(0),
              })
            }
          >
            Clear
          </button>
          <button
            className="button small"
            onClick={() =>
              void studio.command({
                type: "pattern",
                trackId: track.id,
                bar,
                steps: values.map((v) =>
                  v
                    ? Math.min(
                        1,
                        Math.max(0.18, v + (Math.random() - 0.5) * 0.18),
                      )
                    : 0,
                ),
              })
            }
          >
            Humanize
          </button>
        </div>
      </div>
      <div className="pattern-meta">
        <div className="bar-tabs" aria-label="Pattern bar">
          {Array.from({ length: studio.session.bars }, (_, i) => (
            <button
              key={i}
              className={bar === i ? "selected" : ""}
              aria-pressed={bar === i}
              onClick={() => setBar(i)}
            >
              Bar {i + 1}
            </button>
          ))}
        </div>
        <span>
          1/16 resolution <i>·</i>{" "}
          <button className="text-button" onClick={() => setEditStep(0)}>
            Edit note & velocity <SlidersHorizontal size={12} />
          </button>
        </span>
      </div>
      <div className="step-sequencer">
        <div className="step-row-labels">
          <span>STEP</span>
          <span>VELOCITY</span>
        </div>
        <div className="step-grid">
          {values.map((velocity, i) => (
            <div
              className={`step-cell ${i % 4 === 0 ? "beat-start" : ""} ${studio.runtime.playing && studio.step === bar * 16 + i ? "playing" : ""}`}
              key={i}
            >
              <span className="step-number">{i + 1}</span>
              <button
                aria-label={`Step ${i + 1}, ${velocity > 0 ? "on" : "off"}`}
                aria-pressed={velocity > 0}
                title={`Step ${i + 1} · ${melodic ? midiName(track.notes[bar * 16 + i] + keyOffset(studio.session.key)) + " · " : ""}Right-click to edit`}
                className={`step-pad ${velocity > 0 ? "on" : ""}`}
                onClick={() =>
                  void studio.command({
                    type: "step",
                    trackId: track.id,
                    index: bar * 16 + i,
                    velocity: velocity > 0 ? 0 : 0.8,
                  })
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  setEditStep(i);
                }}
              >
                {melodic && velocity > 0 ? (
                  <span>
                    {midiName(
                      track.notes[bar * 16 + i] + keyOffset(studio.session.key),
                    )}
                  </span>
                ) : (
                  <i />
                )}
              </button>
              <input
                className="velocity"
                type="range"
                min="0"
                max="1"
                step="0.01"
                aria-label={`Step ${i + 1} velocity`}
                aria-valuetext={`${Math.round(velocity * 100)} percent`}
                value={velocity}
                onChange={(e) =>
                  void studio.command({
                    type: "step",
                    trackId: track.id,
                    index: bar * 16 + i,
                    velocity: Number(e.target.value),
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="sound-controls">
        <Knob
          label="LEVEL"
          ariaLabel={`${track.name} level`}
          value={track.level}
          min={-48}
          max={6}
          step={0.5}
          display={`${track.level.toFixed(1)} dB`}
          color={track.color}
          onChange={(level) => updateTrack({ level })}
        />
        <Knob
          label="PAN"
          ariaLabel={`${track.name} pan`}
          value={track.pan}
          min={-1}
          max={1}
          step={0.05}
          display={
            Math.abs(track.pan) < 0.02
              ? "C"
              : `${Math.round(Math.abs(track.pan) * 100)}${track.pan < 0 ? "L" : "R"}`
          }
          color={track.color}
          onChange={(pan) => updateTrack({ pan })}
        />
        <Knob
          label="TONE"
          ariaLabel={`${track.name} tone`}
          value={track.tone}
          min={0}
          max={100}
          display={`${track.tone}%`}
          color={track.color}
          onChange={(tone) => updateTrack({ tone })}
        />
        <Knob
          label="DECAY"
          ariaLabel={`${track.name} decay`}
          value={track.decay}
          min={30}
          max={2000}
          step={10}
          display={`${track.decay} ms`}
          color={track.color}
          onChange={(decay) => updateTrack({ decay })}
        />
      </div>
      {editStep !== null && (
        <Modal
          title={`Edit step ${editStep + 1} · ${track.name}`}
          onClose={() => setEditStep(null)}
        >
          <div className="modal-body">
            <label className="field">
              Step
              <select
                value={editStep}
                onChange={(e) => setEditStep(Number(e.target.value))}
              >
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i} value={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Velocity · {Math.round(values[editStep] * 100)}%
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={values[editStep]}
                onChange={(e) =>
                  void studio.command({
                    type: "step",
                    trackId: track.id,
                    index: bar * 16 + editStep,
                    velocity: Number(e.target.value),
                  })
                }
              />
            </label>
            {melodic && (
              <label className="field">
                Note · {studio.session.key}
                <select
                  aria-label="Step note"
                  value={track.notes[bar * 16 + editStep]}
                  onChange={(e) =>
                    void studio.command({
                      type: "step",
                      trackId: track.id,
                      index: bar * 16 + editStep,
                      velocity: values[editStep] || 0.8,
                      note: Number(e.target.value),
                    })
                  }
                >
                  {Array.from({ length: 73 }, (_, i) => i + 24).map((n) => (
                    <option key={n} value={n}>
                      {midiName(n + keyOffset(studio.session.key))}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="muted">
              A velocity of zero silences this step. Edits are saved as you
              work.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}
