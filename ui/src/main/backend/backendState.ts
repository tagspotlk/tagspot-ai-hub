/** How long the backend may take to send `ready` before it is declared failed. */
export const STARTUP_TIMEOUT_MS = 15_000;

/** How long stop() waits for the killed process to exit before giving up. */
export const STOP_TIMEOUT_MS = 5_000;

export type BackendState =
  | { status: 'starting' }
  | { status: 'running'; port: number }
  | { status: 'stopped'; reason: 'crashed' | 'quit' }
  | { status: 'failed'; reason: 'timeout' | 'error'; message: string };

export type BackendStateListener = (state: BackendState) => void;
