import type { UiStatus } from './deriveUiStatus.ts';

interface BackendStatusProps {
  status: UiStatus;
  onRetry: () => void;
  onRestart: () => void;
}

/** Shows the backend status with the action that fits it. */
export function BackendStatus({ status, onRetry, onRestart }: BackendStatusProps) {
  switch (status.kind) {
    case 'starting':
      return <p>Starting backend…</p>;
    case 'running':
      return <p>Backend running · v{status.version}</p>;
    case 'stopped':
      return (
        <div>
          <p>Backend stopped</p>
          <button type="button" onClick={onRestart}>
            Restart
          </button>
        </div>
      );
    case 'failed':
      return (
        <div>
          <p>Backend failed to start: {status.message}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      );
  }
}
