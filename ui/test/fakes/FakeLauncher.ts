import type { ParentToBackend } from '@tagspot/server/protocol';
import type { BackendProcess, ProcessLauncher } from '../../src/main/backend/ProcessLauncher.ts';

/** Test double for a backend process: tests drive messages and exits by hand. */
export class FakeProcess implements BackendProcess {
  readonly posted: ParentToBackend[] = [];
  killed = false;
  private messageHandlers: Array<(message: unknown) => void> = [];
  private exitHandlers: Array<(code: number | null) => void> = [];

  postMessage(message: ParentToBackend): void {
    this.posted.push(message);
  }
  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler);
  }
  onExit(handler: (code: number | null) => void): void {
    this.exitHandlers.push(handler);
  }
  kill(): void {
    this.killed = true;
  }
  emitMessage(message: unknown): void {
    this.messageHandlers.forEach((handler) => handler(message));
  }
  emitExit(code: number | null): void {
    this.exitHandlers.forEach((handler) => handler(code));
  }
}

export class FakeLauncher implements ProcessLauncher {
  readonly launched: FakeProcess[] = [];

  launch(): FakeProcess {
    const process = new FakeProcess();
    this.launched.push(process);
    return process;
  }

  get alive(): FakeProcess[] {
    return this.launched.filter((process) => !process.killed);
  }
}
