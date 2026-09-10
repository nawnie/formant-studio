import type { CSSProperties } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Studio } from "../lib/useStudio";
import { MuteSolo } from "./Arrangement";
import { Knob } from "./Controls";
export function Mixer({
  studio,
  selected,
  select,
}: {
  studio: Studio;
  selected: string;
  select: (id: string) => void;
}) {
  return (
    <section className="mixer" aria-label="Six channel mixer">
      <div className="mixer-caption">
        <SlidersHorizontal size={15} />
        <span>Give every sound its space.</span>
        <span>6 CHANNELS / STEREO OUT</span>
      </div>
      <div className="mixer-channels">
        {studio.session.tracks.map((track, i) => (
          <div
            className={`mixer-channel ${selected === track.id ? "selected" : ""}`}
            key={track.id}
            style={{ "--track-color": track.color } as CSSProperties}
          >
            <button className="channel-name" onClick={() => select(track.id)}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{track.name}</strong>
            </button>
            <Knob
              label="PAN"
              value={track.pan}
              ariaLabel={`Mixer ${track.name} pan`}
              min={-1}
              max={1}
              step={0.05}
              display={
                Math.abs(track.pan) < 0.02
                  ? "C"
                  : `${Math.round(Math.abs(track.pan) * 100)}${track.pan < 0 ? "L" : "R"}`
              }
              color={track.color}
              onChange={(pan) =>
                void studio.command({
                  type: "track",
                  trackId: track.id,
                  patch: { pan },
                })
              }
            />
            <div className="fader-wrap">
              <div className="fader-scale" aria-hidden="true">
                <span>+6</span>
                <span>0</span>
                <span>−12</span>
                <span>−24</span>
                <span>−48</span>
              </div>
              <input
                className="channel-fader"
                aria-label={`Mixer ${track.name} level`}
                aria-valuetext={`${track.level} dB`}
                type="range"
                min="-48"
                max="6"
                step="0.5"
                value={track.level}
                onChange={(e) =>
                  void studio.command({
                    type: "track",
                    trackId: track.id,
                    patch: { level: Number(e.target.value) },
                  })
                }
              />
            </div>
            <output className="fader-value">
              {track.level.toFixed(1)} <span>dB</span>
            </output>
            <MuteSolo track={track} studio={studio} />
            <div className="channel-color" />
          </div>
        ))}
      </div>
    </section>
  );
}
