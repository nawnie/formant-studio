import type { createSession } from "../shared/session.mjs";
export type Session = ReturnType<typeof createSession>;
export type Track = Session["tracks"][number];
export interface Snapshot {
  session: Session;
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
}
export type Command = { type: string; [key: string]: unknown };
export interface ExportJob {
  id: string;
  status: string;
  path?: string;
  bytes?: number;
  error?: string;
}
export interface Runtime {
  audioState: string;
  playing: boolean;
  sampleRate: number | null;
  peak?: number;
}
