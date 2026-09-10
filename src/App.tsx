import { useEffect, useState } from "react";
import { Check, Circle, Plug, Radio, WifiOff } from "lucide-react";
import { useStudio } from "./lib/useStudio";
import { Header, Library, Rail } from "./components/Shell";
import type { Panel } from "./components/Shell";
import { Transport } from "./components/Transport";
import { Arrangement } from "./components/Arrangement";
import { Mixer } from "./components/Mixer";
import { PatternEditor } from "./components/PatternEditor";
import { Panels } from "./components/Panels";

export default function App() {
  const studio = useStudio();
  const [selected, setSelected] = useState("kick"),
    [bar, setBar] = useState(0),
    [view, setView] = useState<"arrangement" | "mixer">("arrangement");
  const [panel, setPanel] = useState<Panel>(null),
    [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth > 1000);
  const activeBar = Math.min(bar, studio.session.bars - 1),
    track = studio.session.tracks.find((t) => t.id === selected)!;
  useEffect(() => {
    document.title = `FORMANT — ${studio.session.name}`;
  }, [studio.session.name]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        studio.saveProject();
        return;
      }
      if (
        panel ||
        (event.target instanceof HTMLElement &&
          (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
            event.target.isContentEditable))
      )
        return;
      if (event.code === "Space" && event.target instanceof HTMLButtonElement)
        return;
      if (event.code === "Space") {
        event.preventDefault();
        void studio.transport(studio.runtime.playing ? "pause" : "play");
      }
      if (event.key === "Escape") {
        event.preventDefault();
        void studio.transport("stop");
      }
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey ? studio.canRedo : studio.canUndo)
          void studio.command({ type: event.shiftKey ? "redo" : "undo" });
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        studio.saveProject();
      }
      if (event.key === "?") setPanel("help");
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [studio, panel]);
  return (
    <div className={`studio ${libraryOpen ? "with-library" : ""}`}>
      <a className="skip-link" href="#workspace">
        Skip to studio
      </a>
      <Header studio={studio} openExport={() => setPanel("export")} />
      <div className="app-body">
        <Rail
          libraryOpen={libraryOpen}
          toggleLibrary={() => setLibraryOpen((v) => !v)}
          view={view}
          setView={setView}
          panel={panel}
          openPanel={setPanel}
        />
        {libraryOpen && (
          <>
            <button
              className="library-scrim"
              aria-label="Dismiss sound library"
              onClick={() => setLibraryOpen(false)}
            />
            <Library
              studio={studio}
              selected={selected}
              select={(id) => {
                setSelected(id);
                if (window.innerWidth <= 1000) setLibraryOpen(false);
              }}
              close={() => setLibraryOpen(false)}
            />
          </>
        )}
        <main id="workspace" tabIndex={-1}>
          <Transport studio={studio} />
          {!studio.connected && (
            <div className="connection-banner" role="status">
              <WifiOff size={15} />
              Connecting to the local studio… Editing resumes when the
              connection is restored.
            </div>
          )}
          <div className="workspace-tabs">
            <div
              role="tablist"
              aria-label="Workspace view"
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const target =
                    event.key === "Home"
                      ? "arrangement"
                      : event.key === "End"
                        ? "mixer"
                        : view === "arrangement"
                          ? "mixer"
                          : "arrangement";
                  setView(target);
                  document.getElementById(`tab-${target}`)?.focus();
                }
              }}
            >
              <button
                role="tab"
                id="tab-arrangement"
                aria-controls="work-view"
                tabIndex={view === "arrangement" ? 0 : -1}
                aria-selected={view === "arrangement"}
                onClick={() => setView("arrangement")}
              >
                Arrangement
              </button>
              <button
                role="tab"
                id="tab-mixer"
                aria-controls="work-view"
                tabIndex={view === "mixer" ? 0 : -1}
                aria-selected={view === "mixer"}
                onClick={() => setView("mixer")}
              >
                Mixer
              </button>
            </div>
            <div className="workspace-options">
              <label>
                <span className="sr-only">Loop length</span>
                <select
                  aria-label="Loop length"
                  value={studio.session.bars}
                  onChange={(e) =>
                    void studio.command({
                      type: "session",
                      patch: { bars: Number(e.target.value) },
                    })
                  }
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "bar" : "bars"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button ai-button"
                aria-label="AI connection"
                onClick={() => setPanel("ai")}
              >
                <Plug size={16} />
                <span>AI connection</span>
                <i className={studio.connected ? "online" : ""} />
              </button>
            </div>
          </div>
          <div
            className="work-view"
            role="tabpanel"
            id="work-view"
            aria-labelledby={`tab-${view}`}
            aria-label={view === "arrangement" ? "Arrangement" : "Mixer"}
          >
            {view === "arrangement" ? (
              <Arrangement
                studio={studio}
                selected={selected}
                bar={activeBar}
                select={(id, b) => {
                  setSelected(id);
                  setBar(b);
                }}
              />
            ) : (
              <Mixer studio={studio} selected={selected} select={setSelected} />
            )}
          </div>
          <PatternEditor
            studio={studio}
            track={track}
            bar={activeBar}
            setBar={setBar}
          />
        </main>
      </div>
      <footer className="status-bar">
        <span>
          <i
            className={`status-dot ${studio.runtime.playing ? "online" : ""}`}
          />
          {studio.runtime.playing
            ? "Audio running"
            : studio.runtime.audioState === "running"
              ? "Audio ready"
              : "Audio standby"}
        </span>
        <span className="status-center">
          {studio.runtime.sampleRate
            ? `${studio.runtime.sampleRate / 1000} kHz`
            : "WEB AUDIO"}
          <i>/</i>Stereo
        </span>
        <span className="save-status">
          {studio.connected ? (
            studio.saving ? (
              <Circle size={11} />
            ) : (
              <Check size={13} />
            )
          ) : (
            <WifiOff size={13} />
          )}{" "}
          {studio.connected
            ? studio.saving
              ? "Saving…"
              : "All changes saved locally"
            : "Disconnected"}
        </span>
      </footer>
      {studio.toast && (
        <div className="toast" role="status">
          <Radio size={15} />
          {studio.toast}
        </div>
      )}
      <Panels panel={panel} studio={studio} close={() => setPanel(null)} />
    </div>
  );
}
