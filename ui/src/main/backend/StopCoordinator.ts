import type { BackendProcess } from './ProcessLauncher.ts';

/**
 * Tracks stops in flight: each resolves when its process exits or after the stop timeout,
 * and a stop requested with no process joins the newest one still in flight.
 */
export class StopCoordinator {
  private inFlight: Promise<void> | null = null;
  private readonly exitWaiters = new Map<BackendProcess, () => void>();

  constructor(private readonly stopTimeoutMs: number) {}

  /** Waits for `process` to exit (bounded by the timeout); with no process, joins the in-flight stop. */
  waitForExit(process: BackendProcess | null): Promise<void> {
    if (!process) return this.inFlight ?? Promise.resolve();
    const stop: Promise<void> = new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        this.exitWaiters.delete(process);
        // A newer stop may have replaced this one; only clear our own.
        if (this.inFlight === stop) this.inFlight = null;
        resolve();
      };
      const timer = setTimeout(finish, this.stopTimeoutMs);
      this.exitWaiters.set(process, finish);
    });
    this.inFlight = stop;
    return stop;
  }

  /** Called for every process exit; finishes the stop waiting for that process, if any. */
  notifyExit(process: BackendProcess): void {
    this.exitWaiters.get(process)?.();
  }
}
