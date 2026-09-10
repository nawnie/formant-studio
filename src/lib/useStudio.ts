import { useEffect, useRef, useState } from "react";
import { createSession, applyCommand } from "../../shared/session.mjs";
import { AudioEngine, renderWav } from "../audio/engine";
import { api, download } from "./api";
import type { Command, ExportJob, Runtime, Session, Snapshot } from "../types";

export function useStudio() {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    session: createSession(),
    revision: 0,
    canUndo: false,
    canRedo: false,
  });
  const [connected, setConnected] = useState(false),
    [saving, setSaving] = useState(false),
    [toast, setToast] = useState("");
  const [runtime, setRuntime] = useState<Runtime>({
    audioState: "suspended",
    playing: false,
    sampleRate: null,
  });
  const [step, setStep] = useState(0),
    [exporting, setExporting] = useState(false),
    [lastExport, setLastExport] = useState<{
      duration: number;
      bytes: number;
      peak: number;
      rms: number;
    } | null>(null);
  const engine = useRef(new AudioEngine(snapshot.session)),
    clientId = useRef(crypto.randomUUID());
  const confirmed = useRef(snapshot),
    pending = useRef<Command[]>([]),
    flushing = useRef(false);
  const [spectrum, setSpectrum] = useState<number[]>(Array(24).fill(0));
  const notify = (message: string) => setToast(message);
  const show = () => {
    let session = confirmed.current.session;
    for (const command of pending.current) {
      if (!["undo", "redo"].includes(command.type))
        try {
          session = applyCommand(session, command);
        } catch {
          /* Confirmed server state remains authoritative. */
        }
    }
    const visible = { ...confirmed.current, session };
    engine.current.update(session);
    setSnapshot(visible);
  };
  const reportRuntime = async () => {
    const e = engine.current,
      value = {
        audioState: e.context?.state || "suspended",
        playing: e.playing,
        sampleRate: e.context?.sampleRate || null,
        peak: e.peak,
      };
    setRuntime(value);
    try {
      await api("/api/runtime", { id: clientId.current, ...value });
    } catch {
      /* Event stream exposes connectivity separately. */
    }
  };
  useEffect(() => {
    const e = engine.current;
    let lastFrame = 0;
    e.onState = () => {
      void reportRuntime();
    };
    e.onFrame = (index, bins) => {
      setStep(index);
      if (performance.now() - lastFrame > 60) {
        setSpectrum(
          Array.from({ length: 24 }, (_, i) => (bins[i * 3 + 1] || 0) / 255),
        );
        lastFrame = performance.now();
      }
    };
    const events = new EventSource(`/api/events?client=${clientId.current}`);
    events.onopen = () => {
      confirmed.current = { ...confirmed.current, revision: -1 };
      setConnected(true);
      void reportRuntime();
    };
    events.onerror = () => {
      setConnected(false);
      if (e.playing) e.stop();
    };
    events.addEventListener("session", (event) => {
      const next = JSON.parse(event.data) as Snapshot;
      if (next.revision >= confirmed.current.revision) {
        confirmed.current = next;
        show();
      }
    });
    events.addEventListener("transport", (event) => {
      try {
        const { action } = JSON.parse(event.data);
        if (action === "play") e.play();
        else if (action === "pause") e.pause();
        else e.stop();
      } catch (error) {
        notify((error as Error).message);
      }
    });
    events.addEventListener("export", async (event) => {
      const { job, session } = JSON.parse(event.data) as {
        job: ExportJob;
        session: Session;
      };
      setExporting(true);
      try {
        const result = await renderWav(session);
        const res = await fetch(`/api/jobs/${job.id}/audio`, {
          method: "POST",
          headers: {
            "Content-Type": "audio/wav",
            "X-Formant-Client": clientId.current,
          },
          body: result.blob,
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setLastExport({
          duration: result.duration,
          bytes: result.blob.size,
          peak: result.peak,
          rms: result.rms,
        });
        notify("AI export rendered and saved to this computer.");
      } catch (error) {
        void api("/api/job-failed", {
          id: job.id,
          clientId: clientId.current,
          error: (error as Error).message,
        });
        notify(`Export failed: ${(error as Error).message}`);
      } finally {
        setExporting(false);
      }
    });
    const heartbeat = setInterval(() => {
      void reportRuntime();
    }, 1500);
    return () => {
      events.close();
      clearInterval(heartbeat);
      void e.dispose();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function command(value: Command) {
    if (!connected) {
      notify("Studio disconnected. Reconnect before editing.");
      return;
    }
    pending.current.push(value);
    setSaving(true);
    show();
    if (flushing.current) return;
    flushing.current = true;
    while (pending.current.length) {
      try {
        const next = await api<Snapshot>("/api/command", pending.current[0]);
        if (next.revision >= confirmed.current.revision)
          confirmed.current = next;
      } catch (error) {
        notify(`Edit was not saved: ${(error as Error).message}`);
      }
      pending.current.shift();
      show();
    }
    flushing.current = false;
    setSaving(false);
  }
  async function transport(action: "play" | "pause" | "stop") {
    try {
      if (action === "play") {
        await engine.current.unlock();
        await reportRuntime();
      }
      await api("/api/transport", { action, clientId: clientId.current });
    } catch (error) {
      notify((error as Error).message);
    }
  }
  async function exportAudio(downloadNow = true) {
    setExporting(true);
    try {
      const result = await renderWav(snapshot.session);
      if (downloadNow)
        download(
          result.blob,
          `${snapshot.session.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.wav`,
        );
      setLastExport({
        duration: result.duration,
        bytes: result.blob.size,
        peak: result.peak,
        rms: result.rms,
      });
      if (downloadNow)
        notify(
          `WAV exported · ${result.duration.toFixed(1)} seconds · 48 kHz stereo`,
        );
      return result;
    } catch (error) {
      notify(`Export failed: ${(error as Error).message}`);
    } finally {
      setExporting(false);
    }
  }
  function saveProject() {
    download(
      new Blob([JSON.stringify(snapshot.session, null, 2)], {
        type: "application/json",
      }),
      `${snapshot.session.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.formant.json`,
    );
    notify("Project file saved. Reopen it from Projects.");
  }
  return {
    ...snapshot,
    connected,
    saving,
    toast,
    notify,
    runtime,
    step,
    spectrum,
    engine: engine.current,
    command,
    transport,
    exportAudio,
    exporting,
    lastExport,
    saveProject,
    clientId: clientId.current,
  };
}
export type Studio = ReturnType<typeof useStudio>;
