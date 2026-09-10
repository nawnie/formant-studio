import type { CSSProperties } from "react";
import { AudioLines, Disc3 } from "lucide-react";
import type { Studio } from "../lib/useStudio";
import type { Track } from "../types";
import { isAudible } from "../../shared/session.mjs";

export function MuteSolo({ track, studio }: { track: Track; studio: Studio }) {
  return (
    <div className="mute-solo">
      <button
        title={`Mute ${track.name}`}
        aria-label={`Mute ${track.name}`}
        aria-pressed={track.mute}
        className={track.mute ? "muted-active" : ""}
        onClick={() =>
          void studio.command({
            type: "track",
            trackId: track.id,
            patch: { mute: !track.mute },
          })
        }
      >
        M
      </button>
      <button
        title={`Solo ${track.name}`}
        aria-label={`Solo ${track.name}`}
        aria-pressed={track.solo}
        className={track.solo ? "solo-active" : ""}
        onClick={() =>
          void studio.command({
            type: "track",
            trackId: track.id,
            patch: { solo: !track.solo },
          })
        }
      >
        S
      </button>
    </div>
  );
}
export function PatternGraphic({ track, bar }: { track: Track; bar: number }) {
  const melodic = ["bass", "keys", "pad"].includes(track.kind);
  return (
    <svg
      className="clip-notes"
      viewBox="0 0 160 36"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {track.steps
        .slice(bar * 16, bar * 16 + 16)
        .map((v, i) =>
          v > 0 ? (
            <rect
              key={i}
              x={i * 10 + 2}
              y={
                melodic
                  ? 29 - (track.notes[bar * 16 + i] % 12) * 1.6
                  : 18 - v * 10
              }
              width={
                track.kind === "pad"
                  ? 144
                  : track.kind === "bass"
                    ? 27
                    : melodic
                      ? 7
                      : 2.4
              }
              height={melodic ? 2.6 : v * 19 + 3}
              rx={melodic ? 0.5 : 1}
              opacity={0.45 + v * 0.55}
            />
          ) : null,
        )}
    </svg>
  );
}
export function Arrangement({
  studio,
  selected,
  bar,
  select,
}: {
  studio: Studio;
  selected: string;
  bar: number;
  select: (id: string, bar: number) => void;
}) {
  return (
    <div className="arrangement-scroll">
      <section
        className="arrangement"
        aria-label={`${studio.session.bars} bar arrangement`}
        style={
          {
            "--bars": studio.session.bars,
            "--progress": studio.step / (studio.session.bars * 16),
            "--bar-progress": (studio.step % 16) / 16,
          } as CSSProperties
        }
      >
        <div className="ruler-head">
          <span>TRACKS</span>
          <span>06</span>
        </div>
        <div className="ruler">
          {Array.from({ length: studio.session.bars }, (_, i) => (
            <button
              key={i}
              className={bar === i ? "current-bar" : ""}
              aria-label={`Go to bar ${i + 1}`}
              aria-pressed={bar === i}
              onClick={() => {
                select(selected, i);
                studio.engine.seek(i * 16);
              }}
            >
              <b>
                <em className="mobile-only">BAR </em>
                {i + 1}
              </b>
              <span>
                1 <i>2</i>
                <i>3</i>
                <i>4</i>
              </span>
            </button>
          ))}
        </div>
        <div className="region-label">
          <Disc3 size={12} />
          <span>{studio.session.name.toUpperCase()} / A</span>
          <span className="desktop-only">{studio.session.bars} BARS</span>
          <span className="mobile-only">BAR {bar + 1}</span>
        </div>
        {studio.session.tracks.map((track, i) => (
          <div
            className={`track-row ${selected === track.id ? "selected" : ""} ${!isAudible(track, studio.session.tracks) ? "inaudible" : ""}`}
            key={track.id}
            style={{ "--track-color": track.color } as CSSProperties}
          >
            <div className="track-header">
              <button
                className="track-select"
                onClick={() => select(track.id, bar)}
                aria-label={`Edit ${track.name}`}
              >
                <span className="track-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="track-name">
                  {track.name}
                  <small>
                    {["KICK", "CLAP", "HI-HAT", "BASS", "KEYS", "PAD"][i]}
                  </small>
                </span>
              </button>
              <MuteSolo track={track} studio={studio} />
            </div>
            <div className="track-lane">
              {Array.from({ length: studio.session.bars }, (_, b) => (
                <button
                  key={b}
                  className={`clip ${b === bar ? "visible-bar" : ""} ${selected === track.id && b === bar ? "clip-selected" : ""}`}
                  aria-label={`${track.name}, bar ${b + 1}`}
                  aria-pressed={selected === track.id && b === bar}
                  onClick={() => select(track.id, b)}
                >
                  <span className="clip-title">
                    <AudioLines size={10} />
                    {track.name}
                    <span>{String(b + 1).padStart(2, "0")}</span>
                  </span>
                  <PatternGraphic track={track} bar={b} />
                </button>
              ))}
            </div>
          </div>
        ))}
        <div
          className={`playhead ${studio.runtime.playing ? "moving" : ""} ${Math.floor(studio.step / 16) !== bar ? "outside-bar" : ""}`}
          aria-hidden="true"
        >
          <span />
        </div>
      </section>
    </div>
  );
}
