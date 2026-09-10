import { Play, Pause, Square, Repeat2, Volume2 } from "lucide-react";
import { KEYS } from "../../shared/session.mjs";
import type { Studio } from "../lib/useStudio";
import { IconButton } from "./Controls";
import { useState } from "react";
function TempoControl({ studio }: { studio: Studio }) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft !== null) {
      const tempo = Number(draft);
      if (Number.isInteger(tempo) && tempo >= 40 && tempo <= 240) {
        if (tempo !== studio.session.tempo)
          void studio.command({ type: "session", patch: { tempo } });
      } else studio.notify("Tempo must be a whole number from 40 to 240 BPM.");
    }
    setDraft(null);
  }
  return (
    <label className="tempo">
      <input
        type="number"
        aria-label="Tempo BPM"
        min="40"
        max="240"
        value={draft ?? studio.session.tempo}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.stopPropagation();
          }
        }}
      />
      <span>BPM</span>
    </label>
  );
}
export function Transport({ studio }: { studio: Studio }) {
  return (
    <section className="transport" aria-label="Playback controls">
      <div className="transport-buttons">
        <button
          className="play-button"
          aria-label={
            studio.runtime.playing ? "Pause playback" : "Play session"
          }
          title="Play / pause (Space)"
          disabled={!studio.connected}
          onClick={() =>
            void studio.transport(studio.runtime.playing ? "pause" : "play")
          }
        >
          {studio.runtime.playing ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={21} fill="currentColor" />
          )}
        </button>
        <IconButton
          label="Stop and return to start"
          onClick={() => void studio.transport("stop")}
        >
          <Square size={15} fill="currentColor" />
        </IconButton>
        <IconButton
          label="Loop playback"
          active={studio.session.loop}
          aria-pressed={studio.session.loop}
          onClick={() =>
            void studio.command({
              type: "session",
              patch: { loop: !studio.session.loop },
            })
          }
        >
          <Repeat2 size={21} />
        </IconButton>
      </div>
      <div
        className="time-display"
        aria-label={`Bar ${Math.floor(studio.step / 16) + 1}, beat ${Math.floor((studio.step % 16) / 4) + 1}, step ${(studio.step % 4) + 1}`}
      >
        <span>
          {String(Math.floor(studio.step / 16) + 1).padStart(3, "0")} <b>:</b>{" "}
          {String(Math.floor((studio.step % 16) / 4) + 1).padStart(2, "0")}{" "}
          <b>:</b> {String(studio.step % 4).padStart(2, "0")}
        </span>
        <div>
          <small>BAR</small>
          <small>BEAT</small>
          <small>STEP</small>
        </div>
      </div>
      <div className="tempo-group">
        <TempoControl studio={studio} />
        <label className="key-select">
          <span className="sr-only">Musical key</span>
          <select
            aria-label="Musical key"
            value={studio.session.key}
            onChange={(e) =>
              void studio.command({
                type: "session",
                patch: { key: e.target.value },
              })
            }
          >
            {KEYS.map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
        <span className="time-signature" title="Four beats per bar">
          4/4
        </span>
      </div>
      <div className="master-strip">
        <div
          className="spectrum"
          role="img"
          aria-label={
            studio.runtime.playing
              ? "Live output spectrum"
              : "Output spectrum idle"
          }
        >
          {studio.spectrum.map((value, i) => (
            <i
              key={i}
              style={{
                height: `${3 + value * 30}px`,
                opacity: value > 0.05 ? 1 : 0.28,
              }}
            />
          ))}
        </div>
        <Volume2 size={15} />
        <label className="master-volume">
          <span>
            MASTER <output>{studio.session.master.toFixed(1)} dB</output>
          </span>
          <input
            type="range"
            aria-label="Master volume"
            min="-48"
            max="0"
            step="0.5"
            value={studio.session.master}
            onChange={(e) =>
              void studio.command({
                type: "session",
                patch: { master: Number(e.target.value) },
              })
            }
          />
        </label>
      </div>
    </section>
  );
}
