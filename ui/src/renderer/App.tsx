import { BackendStatus } from './status/BackendStatus.tsx';
import { useBackendStatus } from './status/useBackendStatus.ts';

export function App() {
  const status = useBackendStatus();
  const restart = (): void => void window.hub.restartBackend();
  return (
    <main>
      <h1>Tagspot AI Hub</h1>
      <BackendStatus status={status} onRetry={restart} onRestart={restart} />
    </main>
  );
}
