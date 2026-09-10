import { useState } from "react";
import {
  AudioLines,
  SlidersHorizontal,
  Plug,
  FolderOpen,
  CircleHelp,
  Settings2,
  Search,
  Play,
  Undo2,
  Redo2,
  Download,
  Save,
  PanelLeftClose,
  CircleX,
  ChevronRight,
} from "lucide-react";
import { SOUNDS } from "../../shared/session.mjs";
import type { Studio } from "../lib/useStudio";
import { Brand, IconButton } from "./Controls";

export type Panel = "ai" | "projects" | "help" | "settings" | "export" | null;
export function Header({
  studio,
  openExport,
}: {
  studio: Studio;
  openExport: () => void;
}) {
  const [name, setName] = useState<string | null>(null);
  return (
    <header className="header">
      <Brand />
      <div className="project-title">
        <input
          aria-label="Project name"
          maxLength={60}
          value={name ?? studio.session.name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name?.trim() && name !== studio.session.name)
              void studio.command({
                type: "session",
                patch: { name: name.trim() },
              });
            setName(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setName(null);
              e.stopPropagation();
            }
          }}
        />
        <span>
          SESSION 001 <span className="project-dot">·</span>{" "}
          <span className="project-format">LOCAL STUDIO</span>
        </span>
      </div>
      <div className="header-actions">
        <IconButton
          label="Undo (Ctrl/⌘ Z)"
          disabled={!studio.canUndo || studio.saving}
          onClick={() => void studio.command({ type: "undo" })}
        >
          <Undo2 size={18} />
        </IconButton>
        <IconButton
          label="Redo (Ctrl/⌘ Shift Z)"
          disabled={!studio.canRedo || studio.saving}
          onClick={() => void studio.command({ type: "redo" })}
        >
          <Redo2 size={18} />
        </IconButton>
        <button
          className="button save-button"
          aria-label="Save project"
          onClick={studio.saveProject}
        >
          <Save size={15} />
          <span>Save project</span>
        </button>
        <button
          className="button primary"
          disabled={studio.exporting}
          onClick={openExport}
        >
          <Download size={15} />
          <span>{studio.exporting ? "Rendering…" : "Export audio"}</span>
        </button>
      </div>
    </header>
  );
}
export function Rail({
  libraryOpen,
  toggleLibrary,
  view,
  setView,
  openPanel,
  panel,
}: {
  libraryOpen: boolean;
  toggleLibrary: () => void;
  view: string;
  setView: (view: "arrangement" | "mixer") => void;
  openPanel: (panel: Panel) => void;
  panel: Panel;
}) {
  const items = [
    {
      name: "Sounds",
      icon: AudioLines,
      active: libraryOpen && !panel && view === "arrangement",
      click: toggleLibrary,
    },
    {
      name: "Mixer",
      icon: SlidersHorizontal,
      active: view === "mixer" && !panel,
      click: () => setView(view === "mixer" ? "arrangement" : "mixer"),
    },
    {
      name: "AI",
      icon: Plug,
      active: panel === "ai",
      click: () => openPanel("ai"),
    },
    {
      name: "Projects",
      icon: FolderOpen,
      active: panel === "projects",
      click: () => openPanel("projects"),
    },
  ];
  return (
    <nav className="rail" aria-label="Studio navigation">
      {items.map((item) => (
        <button
          key={item.name}
          className={`rail-button ${item.active ? "selected" : ""}`}
          title={item.name}
          aria-label={
            item.name === "Sounds" ? "Toggle sound library" : item.name
          }
          aria-pressed={item.active}
          onClick={item.click}
        >
          <item.icon size={21} />
          <span>{item.name}</span>
        </button>
      ))}
      <div className="rail-spacer" />
      <button
        className="rail-button"
        onClick={() => openPanel("help")}
        aria-label="Help and keyboard shortcuts"
      >
        <CircleHelp size={21} />
        <span>Help</span>
      </button>
      <button
        className="rail-button"
        onClick={() => openPanel("settings")}
        aria-label="Audio settings"
      >
        <Settings2 size={21} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
export function Library({
  studio,
  selected,
  select,
  close,
}: {
  studio: Studio;
  selected: string;
  select: (id: string) => void;
  close: () => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All");
  const sounds = SOUNDS.filter(
    (s) =>
      (filter === "All" || filter === s.group) &&
      `${s.name} ${s.label}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <aside className="library" aria-label="Sound library">
      <div className="library-title">
        <h2>Sound library</h2>
        <IconButton
          label="Close sound library"
          className="library-close"
          onClick={close}
        >
          <PanelLeftClose size={16} />
        </IconButton>
      </div>
      <label className="search">
        <Search size={16} />
        <input
          placeholder="Find a sound"
          aria-label="Find a sound"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <IconButton label="Clear sound search" onClick={() => setSearch("")}>
            <CircleX size={14} />
          </IconButton>
        )}
      </label>
      <div className="filters" aria-label="Sound category">
        {["All", "Drums", "Synths"].map((f) => (
          <button
            key={f}
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="sound-list">
        {sounds.map((sound) => (
          <div
            className={`sound-item ${selected === sound.id ? "selected" : ""}`}
            key={sound.id}
          >
            <button
              className="sound-select"
              onClick={() => select(sound.id)}
              aria-label={`Select ${sound.name}`}
            >
              <AudioLines
                size={21}
                style={{
                  color: selected === sound.id ? sound.color : undefined,
                }}
              />
              <span>
                {sound.name}
                <small>
                  {sound.group === "Drums" ? "Drum machine" : "Analog synth"}
                </small>
              </span>
            </button>
            <IconButton
              label={`Audition ${sound.name}`}
              onClick={() => {
                select(sound.id);
                void studio.engine
                  .preview(
                    studio.session.tracks.find((t) => t.id === sound.id)!,
                  )
                  .catch((e) => studio.notify(e.message));
              }}
            >
              <Play size={12} fill="currentColor" />
            </IconButton>
          </div>
        ))}
        {!sounds.length && (
          <div className="search-empty">
            No matching sounds.
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setFilter("All");
              }}
            >
              Show all sounds <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="library-note">
        <div className="mini-wave" aria-hidden="true">
          {Array.from({ length: 25 }, (_, i) => (
            <i
              key={i}
              style={{
                height: `${8 + Math.sin(i * 0.7) ** 2 * (1 - i / 35) * 24}px`,
              }}
            />
          ))}
        </div>
        <p>
          Made for the
          <br />
          <strong>after hours.</strong>
        </p>
        <div>
          <kbd>Space</kbd>
          <span>to play</span>
        </div>
      </div>
    </aside>
  );
}
