import type { ParentToBackend } from '@tagspot/server/protocol';

/** A running backend process, seen through the parent/backend message channel. */
export interface BackendProcess {
  postMessage(message: ParentToBackend): void;
  /** Messages are untrusted until validated, hence `unknown`. */
  onMessage(handler: (message: unknown) => void): void;
  onExit(handler: (code: number | null) => void): void;
  kill(): void;
}

/** Starts backend processes; the Electron adapter implements this (Adapter pattern). */
export interface ProcessLauncher {
  launch(): BackendProcess;
}
