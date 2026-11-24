import type { RendererBackendState } from '../../main/ipc.ts';

export type UiStatus =
  | { kind: 'starting' }
  | { kind: 'running'; version: string }
  | { kind: 'stopped' }
  | { kind: 'failed'; message: string };

/** Result of the last GET /status; `ok` carries the version the backend reported. */
export type StatusCheck = { kind: 'ok'; version: string } | { kind: 'failed' } | { kind: 'none' };

export const NO_CHECK: StatusCheck = { kind: 'none' };
export const STATUS_CHECK_FAILED: StatusCheck = { kind: 'failed' };

/** Maps supervisor state plus the last GET /status result to what the user sees. */
export function deriveUiStatus(backend: RendererBackendState, lastCheck: StatusCheck): UiStatus {
  switch (backend.status) {
    case 'failed':
      return { kind: 'failed', message: backend.message };
    case 'stopped':
      return { kind: 'stopped' };
    case 'starting':
      return { kind: 'starting' };
    case 'running':
      return deriveRunning(lastCheck);
  }
}

function deriveRunning(lastCheck: StatusCheck): UiStatus {
  switch (lastCheck.kind) {
    case 'ok':
      return { kind: 'running', version: lastCheck.version };
    case 'failed':
      // A running process that does not answer is as good as stopped for the user.
      return { kind: 'stopped' };
    case 'none':
      return { kind: 'starting' };
  }
}
