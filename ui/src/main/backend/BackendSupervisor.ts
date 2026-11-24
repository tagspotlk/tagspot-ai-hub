import type { BackendProcess, ProcessLauncher } from './ProcessLauncher.ts';
import { StopCoordinator } from './StopCoordinator.ts';
import type { BackendState, BackendStateListener } from './backendState.ts';
import { isBackendToParent } from './isBackendToParent.ts';

export const STARTUP_TIMED_OUT_MESSAGE = 'Backend did not become ready in time';
export const EXITED_DURING_STARTUP_MESSAGE = 'Backend exited during startup';
export const INVALID_MESSAGE_MESSAGE = 'Backend sent an invalid message';

export interface SupervisorOptions {
  startupTimeoutMs: number;
  stopTimeoutMs: number;
  createSecret: () => string;
}

/**
 * Owns the backend process and its lifecycle state.
 * Messages and exits from any process other than the current one are ignored,
 * which keeps late `ready` messages and quick restarts from leaking processes.
 * State changes are published with the Observer pattern (`onStateChange`).
 */
export class BackendSupervisor {
  private state: BackendState = { status: 'stopped', reason: 'quit' };
  private current: BackendProcess | null = null;
  private secret = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<BackendStateListener>();
  private readonly stops: StopCoordinator;

  constructor(
    private readonly launcher: ProcessLauncher,
    private readonly options: SupervisorOptions,
  ) {
    this.stops = new StopCoordinator(options.stopTimeoutMs);
  }

  start(): void {
    if (this.current) return;
    this.launch();
  }

  restart(): void {
    this.discardCurrent();
    this.launch();
  }

  stop(): Promise<void> {
    const process = this.current;
    this.discardCurrent();
    this.setState({ status: 'stopped', reason: 'quit' });
    return this.stops.waitForExit(process);
  }

  getState(): BackendState {
    return this.state;
  }

  getConnection(): { port: number; sessionSecret: string } | null {
    if (this.state.status !== 'running') return null;
    return { port: this.state.port, sessionSecret: this.secret };
  }

  onStateChange(listener: BackendStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private launch(): void {
    const process = this.launcher.launch();
    this.current = process;
    this.secret = this.options.createSecret();
    this.setState({ status: 'starting' });
    process.onMessage((message) => this.handleMessage(process, message));
    process.onExit(() => this.handleExit(process));
    process.postMessage({ type: 'init', sessionSecret: this.secret });
    this.timer = setTimeout(
      () => this.fail(process, 'timeout', STARTUP_TIMED_OUT_MESSAGE),
      this.options.startupTimeoutMs,
    );
  }

  private handleMessage(process: BackendProcess, message: unknown): void {
    if (process !== this.current) return;
    if (!isBackendToParent(message)) this.fail(process, 'error', INVALID_MESSAGE_MESSAGE);
    else if (message.type === 'ready') this.markRunning(message.port);
    else this.fail(process, 'error', message.message);
  }

  private markRunning(port: number): void {
    this.clearTimer();
    this.setState({ status: 'running', port });
  }

  private fail(process: BackendProcess, reason: 'timeout' | 'error', message: string): void {
    if (process !== this.current) return;
    this.discardCurrent();
    this.setState({ status: 'failed', reason, message });
  }

  private handleExit(process: BackendProcess): void {
    this.stops.notifyExit(process);
    if (process !== this.current) return;
    const wasStarting = this.state.status === 'starting';
    this.discardCurrent(false);
    this.setState(
      wasStarting
        ? { status: 'failed', reason: 'error', message: EXITED_DURING_STARTUP_MESSAGE }
        : { status: 'stopped', reason: 'crashed' },
    );
  }

  private discardCurrent(kill = true): void {
    this.clearTimer();
    if (kill) this.current?.kill();
    this.current = null;
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private setState(state: BackendState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
}
