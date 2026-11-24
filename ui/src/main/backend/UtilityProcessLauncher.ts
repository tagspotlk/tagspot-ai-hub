import type { utilityProcess } from 'electron';
import type { ParentToBackend } from '@tagspot/server/protocol';
import type { BackendProcess, ProcessLauncher } from './ProcessLauncher.ts';

/** Name Electron reports for the backend process; also used by the e2e test to find it. */
export const BACKEND_SERVICE_NAME = 'tagspot-backend';

export type ForkFunction = typeof utilityProcess.fork;

export interface UtilityProcessLauncherOptions {
  entryPath: string;
  /** Injected so tests can run without the Electron runtime. */
  fork: ForkFunction;
}

/**
 * Adapter from Electron's `utilityProcess` to `ProcessLauncher`.
 * The secret is never passed in args or env; the supervisor sends it with `postMessage`.
 */
export class UtilityProcessLauncher implements ProcessLauncher {
  constructor(private readonly options: UtilityProcessLauncherOptions) {}

  launch(): BackendProcess {
    const child = this.options.fork(this.options.entryPath, [], {
      serviceName: BACKEND_SERVICE_NAME,
    });
    return {
      postMessage: (message: ParentToBackend) => child.postMessage(message),
      onMessage: (handler) => {
        child.on('message', (message: unknown) => handler(message));
      },
      onExit: (handler) => {
        child.on('exit', (code) => handler(code));
      },
      kill: () => {
        child.kill();
      },
    };
  }
}
