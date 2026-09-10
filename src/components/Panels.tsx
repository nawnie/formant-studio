import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileAudio,
  FolderOpen,
  LoaderCircle,
  Music2,
  Plug,
  RefreshCw,
  Upload,
  Zap,
} from "lucide-react";
import { sessionSchema } from "../../shared/session.mjs";
import type { Studio } from "../lib/useStudio";
import { api } from "../lib/api";
import { Modal } from "./Controls";
import type { Panel } from "./Shell";
import { ExportPanel } from "./ExportPanel";

function AiPanel({ studio }: { studio: Studio }) {
  const [info, setInfo] = useState<{ mcp: unknown; url: string } | null>(null),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [check, setCheck] = useState("");
  useEffect(() => {
    void api<{ mcp: unknown; url: string }>("/api/info")
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(info?.mcp, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        "Select and copy the configuration below. Clipboard access is unavailable.",
      );
    }
  }
  return (
    <div className="modal-body ai-panel">
      <div className="ai-intro">
        <span className="ai-symbol">
          <Plug size={28} />
        </span>
        <div>
          <h3>A second set of hands.</h3>
          <p>Connect your AI to the session. Keep your ears in charge.</p>
        </div>
      </div>
      <div className="connection-line">
        <span className={`status-dot ${studio.connected ? "online" : ""}`} />
        <strong>
          {studio.connected ? "Local studio connected" : "Studio disconnected"}
        </strong>
        <code>{info?.url || "Connecting…"}</code>
      </div>
      <div className="ai-capabilities">
        {[
          {
            icon: Music2,
            name: "Compose",
            text: "Edit notes, rhythms and tempo.",
          },
          { icon: Zap, name: "Shape", text: "Dial in all six instruments." },
          {
            icon: FileAudio,
            name: "Finish",
            text: "Mix and render a stereo WAV.",
          },
        ].map((c) => (
          <div key={c.name}>
            <c.icon size={18} />
            <strong>{c.name}</strong>
            <span>{c.text}</span>
          </div>
        ))}
      </div>
      <div className="config-heading">
        <h4>Connect with MCP</h4>
        <button
          className="button primary"
          disabled={!info}
          onClick={() => void copy()}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
          {copied ? "Copied" : "Copy configuration"}
        </button>
      </div>
      <ol className="connection-steps">
        <li>Copy your studio configuration.</li>
        <li>Add it in your AI client’s MCP server settings.</li>
        <li>Keep this studio open and ask your AI to make music.</li>
      </ol>
      <details className="config-details">
        <summary>View configuration</summary>
        <pre className="mcp-config" tabIndex={0}>
          {info
            ? JSON.stringify(info.mcp, null, 2)
            : error || "Loading your local configuration…"}
        </pre>
      </details>
      <div className="ai-note">
        <strong>Press Play once to enable audio.</strong>
        <span>
          Your browser requires a user gesture before an AI can start playback.
          Session editing and offline export work while stopped.
        </span>
      </div>
      <div className="try-prompt">
        <span>TRY ASKING YOUR CONNECTED AI</span>
        <p>
          “Make this a late-night groove at 112 BPM. Soften the hats, add a
          syncopated bass line, and leave space for the keys.”
        </p>
      </div>
      <button
        className="button"
        onClick={() =>
          void api<{ revision: number; session: { tracks: unknown[] } }>(
            "/api/session",
          )
            .then((value) =>
              setCheck(
                `Studio reachable · ${value.session.tracks.length} instruments · revision ${value.revision}`,
              ),
            )
            .catch((e) => setCheck(e.message))
        }
      >
        <RefreshCw size={14} />
        Check studio connection
      </button>
      {check && (
        <p className="check-result" role="status">
          {check}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
function ProjectsPanel({
  studio,
  close,
}: {
  studio: Studio;
  close: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="modal-body">
      <p className="modal-lead">Every good session starts somewhere.</p>
      <div className="preset-list">
        {[
          {
            id: "midnight",
            title: "Midnight signal",
            text: "108 BPM · D minor · warm, textured, after hours",
            glyph: "01",
          },
          {
            id: "daybreak",
            title: "Daybreak drive",
            text: "124 BPM · D minor · steady pulse, open space",
            glyph: "02",
          },
          {
            id: "empty",
            title: "A blank canvas",
            text: "Six instruments. Your next idea.",
            glyph: "03",
          },
        ].map((preset) => (
          <button
            className="preset"
            key={preset.id}
            onClick={() => {
              void studio.command({ type: "preset", preset: preset.id });
              studio.engine.stop();
              close();
            }}
          >
            <span>{preset.glyph}</span>
            <div>
              <strong>{preset.title}</strong>
              <small>{preset.text}</small>
            </div>
            <Music2 size={18} />
          </button>
        ))}
      </div>
      <p className="muted">
        Loading a starter replaces the current session. Undo brings it back.
      </p>
      <div className="project-file-actions">
        <button className="button" onClick={() => file.current?.click()}>
          <Upload size={15} />
          Open project
        </button>
        <button className="button" onClick={studio.saveProject}>
          <Download size={15} />
          Save current project
        </button>
      </div>
      <input
        className="sr-only"
        ref={file}
        type="file"
        tabIndex={-1}
        accept=".json,.formant.json"
        aria-label="Open a FORMANT project file"
        onChange={async (e) => {
          const value = e.target.files?.[0];
          if (!value) return;
          try {
            if (value.size > 1000000)
              throw new Error("Project files must be smaller than 1 MB.");
            const session = sessionSchema.parse(JSON.parse(await value.text()));
            await studio.command({ type: "replace", session });
            studio.engine.stop();
            close();
            studio.notify("Project opened.");
          } catch (error) {
            studio.notify(
              `Project was not opened: ${(error as Error).message}`,
            );
          }
        }}
      />
    </div>
  );
}
function HelpPanel() {
  return (
    <div className="modal-body">
      <p className="modal-lead">An idea to a loop. One step at a time.</p>
      <ol className="workflow">
        <li>
          <strong>Find your sound.</strong>
          <span>
            Select one of the six instruments. The small play icon auditions it.
          </span>
        </li>
        <li>
          <strong>Shape the rhythm.</strong>
          <span>
            Click steps to turn them on. Drag the velocity controls underneath.
            Select a bar to make variations; right-click a step to change a
            note.
          </span>
        </li>
        <li>
          <strong>Make room in the mix.</strong>
          <span>
            Use M to mute and S to solo. Level, pan, tone and decay shape each
            instrument. The Mixer gives you all six channels at once.
          </span>
        </li>
        <li>
          <strong>Keep the take.</strong>
          <span>
            Your session autosaves on this computer. Save project creates a
            portable file; Export audio renders a 48 kHz stereo WAV with a
            two-second release tail.
          </span>
        </li>
      </ol>
      <div className="shortcuts">
        <span>
          Play / pause<kbd>Space</kbd>
        </span>
        <span>
          Stop<kbd>Esc</kbd>
        </span>
        <span>
          Undo<kbd>Ctrl/⌘ Z</kbd>
        </span>
        <span>
          Redo<kbd>Ctrl/⌘ ⇧ Z</kbd>
        </span>
        <span>
          Save project<kbd>Ctrl/⌘ S</kbd>
        </span>
        <span>
          Keyboard help<kbd>?</kbd>
        </span>
      </div>
      <p className="muted">
        FORMANT is a synthesis-based groove workstation. It runs locally in
        modern browsers on Windows and macOS. It does not host VST plug-ins or
        record microphones.
      </p>
    </div>
  );
}
function SettingsPanel({ studio }: { studio: Studio }) {
  return (
    <div className="modal-body">
      <div className="audio-info">
        <span>
          Audio engine<strong>Web Audio</strong>
        </span>
        <span>
          State<strong>{studio.runtime.audioState}</strong>
        </span>
        <span>
          Device sample rate
          <strong>
            {studio.runtime.sampleRate
              ? `${studio.runtime.sampleRate / 1000} kHz`
              : "Available after Play"}
          </strong>
        </span>
        <span>
          Export format<strong>48 kHz · 16-bit stereo WAV</strong>
        </span>
      </div>
      <label className="field">
        Swing <output>{studio.session.swing}%</output>
        <input
          aria-label="Swing percentage"
          type="range"
          min="0"
          max="60"
          value={studio.session.swing}
          onChange={(e) =>
            void studio.command({
              type: "session",
              patch: { swing: Number(e.target.value) },
            })
          }
        />
      </label>
      <p className="muted">
        Swing delays every second sixteenth note. Zero is straight; subtle
        amounts give the rhythm some breathing room.
      </p>
      <p className="muted">
        Output follows your operating system’s default audio device. No
        microphone permission is requested.
      </p>
      {studio.lastExport && (
        <div className="export-receipt">
          <h4>Last completed render</h4>
          <dl>
            <dt>Duration, including release tail</dt>
            <dd>{studio.lastExport.duration.toFixed(3)} s</dd>
            <dt>File size</dt>
            <dd>{studio.lastExport.bytes.toLocaleString()} bytes</dd>
            <dt>Measured peak</dt>
            <dd>
              {studio.lastExport.peak
                ? (20 * Math.log10(studio.lastExport.peak)).toFixed(1)
                : "−∞"}{" "}
              dBFS
            </dd>
            <dt>Measured RMS</dt>
            <dd>
              {studio.lastExport.rms
                ? (20 * Math.log10(studio.lastExport.rms)).toFixed(1)
                : "−∞"}{" "}
              dBFS
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
}
export function Panels({
  panel,
  studio,
  close,
}: {
  panel: Panel;
  studio: Studio;
  close: () => void;
}) {
  if (!panel) return null;
  return (
    <Modal
      title={
        {
          ai: "AI connection",
          projects: "Projects",
          help: "The studio, explained",
          settings: "Audio settings",
          export: "Export audio",
        }[panel]
      }
      wide={panel === "ai"}
      onClose={close}
    >
      {panel === "ai" ? (
        <AiPanel studio={studio} />
      ) : panel === "projects" ? (
        <ProjectsPanel studio={studio} close={close} />
      ) : panel === "help" ? (
        <HelpPanel />
      ) : panel === "export" ? (
        <ExportPanel studio={studio} />
      ) : (
        <SettingsPanel studio={studio} />
      )}
    </Modal>
  );
}
