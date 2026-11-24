import type { BackendSupervisor } from './backend/BackendSupervisor.ts';

export interface QuitApp {
  on(event: 'before-quit', handler: (event: { preventDefault(): void }) => void): void;
  quit(): void;
}

/**
 * Holds the quit until the backend has stopped, so no orphan process is left behind.
 * The second `before-quit` (raised by our own `quit()`) finds the backend stopped and passes.
 */
export function registerQuitHandler(
  app: QuitApp,
  supervisor: Pick<BackendSupervisor, 'stop' | 'getState'>,
): void {
  let stopInProgress = false;
  app.on('before-quit', (event) => {
    if (stopInProgress) {
      event.preventDefault();
      return;
    }
    if (supervisor.getState().status === 'stopped') return;
    event.preventDefault();
    stopInProgress = true;
    void supervisor.stop().finally(() => {
      stopInProgress = false;
      app.quit();
    });
  });
}
