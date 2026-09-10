import { useEffect, useState } from "react";
import { Check, Download, LoaderCircle, AudioLines } from "lucide-react";
import type { Studio } from "../lib/useStudio";
import type { renderWav } from "../audio/engine";
import { download } from "../lib/api";
export function ExportPanel({ studio }: { studio: Studio }) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof renderWav>
  > | null>(null);
  const [source, setSource] = useState(""),
    [name, setName] = useState(studio.session.name),
    [error, setError] = useState("");
  useEffect(() => {
    if (!result) return;
    const objectUrl = URL.createObjectURL(result.blob);
    setSource(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result]);
  const peakDb = result?.peak
    ? `${(20 * Math.log10(result.peak)).toFixed(1)} dBFS`
    : "−∞ dBFS";
  return (
    <div className="modal-body export-panel">
      <div className="export-intro">
        <span className="ai-symbol">
          <AudioLines size={28} />
        </span>
        <div>
          <h3>Let it leave the studio.</h3>
          <p>Your mix. Rendered exactly as you made it.</p>
        </div>
      </div>
      <div className="export-format">
        <div>
          <span>FORMAT</span>
          <strong>
            WAV <small>Uncompressed audio</small>
          </strong>
        </div>
        <div>
          <span>QUALITY</span>
          <strong>
            48 kHz <small>16-bit · Stereo</small>
          </strong>
        </div>
        <div>
          <span>RANGE</span>
          <strong>
            {studio.session.bars} bars <small>+ 2 second release tail</small>
          </strong>
        </div>
      </div>
      {result ? (
        <>
          <div
            className="render-wave"
            role="img"
            aria-label="Measured waveform of the rendered stereo mix"
          >
            <svg viewBox="0 0 480 90" preserveAspectRatio="none">
              {result.waveform.map((v, i) => (
                <rect
                  key={i}
                  x={i * 5}
                  y={45 - Math.max(1, (v / Math.max(result.peak, 0.001)) * 38)}
                  width="2.5"
                  height={Math.max(2, (v / Math.max(result.peak, 0.001)) * 76)}
                  rx="1"
                />
              ))}
            </svg>
          </div>
          <audio
            controls
            src={source}
            aria-label="Preview rendered mix"
            className="export-preview"
          />
          <div className="render-stats">
            <span>{result.duration.toFixed(2)} seconds</span>
            <span>{(result.blob.size / 1000000).toFixed(2)} MB</span>
            <span>Peak {peakDb}</span>
          </div>
          <div className="render-complete">
            <Check size={15} />
            Render complete. Listen before you download.
          </div>
          <div className="export-actions">
            <button
              className="button"
              disabled={studio.exporting}
              onClick={() => {
                setResult(null);
                setSource("");
              }}
            >
              New render
            </button>
            <button
              className="button primary"
              onClick={() =>
                download(
                  result.blob,
                  `${name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.wav`,
                )
              }
            >
              <Download size={15} />
              Download WAV
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="export-summary">
            <strong>{studio.session.name}</strong>
            <span>
              {studio.session.tempo} BPM · {studio.session.key}
            </span>
            <p>
              Includes your notes, velocities, sound settings and mix. Muted
              tracks stay silent. The release tail lets the final notes fade
              naturally.
            </p>
          </div>
          <button
            className="button primary render-button"
            disabled={studio.exporting || studio.saving}
            onClick={async () => {
              setError("");
              setName(studio.session.name);
              const rendered = await studio.exportAudio(false);
              if (rendered) setResult(rendered);
              else setError("This render did not finish. Please try again.");
            }}
          >
            {studio.exporting ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <AudioLines size={16} />
            )}{" "}
            {studio.exporting ? "Rendering your take…" : "Render WAV"}
          </button>
          <p className="export-local">
            Rendered on this computer. Your music stays here.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
