import type { BackendToParent, ParentToBackend } from '../protocol.ts';

/**
 * parentPort offers no delivery callback, so a post is treated as flushed after this delay.
 * Long enough for Electron to hand the message over before the process exits.
 */
export const PARENT_PORT_FLUSH_DELAY_MS = 100;
export const NO_PARENT_CHANNEL_MESSAGE = 'Backend has no parent channel';

/** Message channel to the parent process, independent of how the parent started us. */
export interface ParentChannel {
  onMessage(handler: (message: ParentToBackend) => void): void;
  /** Resolves once the message has been handed to the parent, so it is safe to exit afterwards. */
  postMessage(message: BackendToParent): Promise<void>;
  onClose(handler: () => void): void;
}

/** Minimal shape of `process.parentPort` (set in a utilityProcess child); declared locally because @types/node lacks it. */
export interface ParentPort {
  on(event: 'message', listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
}

/** The parts of a Node IPC child process the channel uses. */
export interface NodeIpc {
  send(message: unknown, callback: (error: Error | null) => void): boolean;
  on(event: 'message' | 'disconnect', listener: (message?: unknown) => void): void;
}

const getParentPort = (): ParentPort | undefined =>
  (process as unknown as { parentPort?: ParentPort }).parentPort;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const createUtilityProcessChannel = (port: ParentPort): ParentChannel => ({
  onMessage: (handler) => port.on('message', (event) => handler(event.data as ParentToBackend)),
  postMessage: (message) => {
    port.postMessage(message);
    return delay(PARENT_PORT_FLUSH_DELAY_MS);
  },
  // parentPort exposes no close event; watchParent covers a vanished parent.
  onClose: () => undefined,
});

export const createNodeIpcChannel = (ipc: NodeIpc): ParentChannel => ({
  onMessage: (handler) => ipc.on('message', (message) => handler(message as ParentToBackend)),
  postMessage: (message) =>
    new Promise((resolve, reject) => {
      ipc.send(message, (error) => (error ? reject(error) : resolve()));
    }),
  onClose: (handler) => ipc.on('disconnect', handler),
});

const getNodeIpc = (): NodeIpc | undefined =>
  process.send ? (process as unknown as NodeIpc) : undefined;

/** Uses `process.parentPort` in a utilityProcess child, otherwise Node IPC; throws when there is neither. */
export const createParentChannel = (): ParentChannel => {
  const parentPort = getParentPort();
  if (parentPort) return createUtilityProcessChannel(parentPort);
  const nodeIpc = getNodeIpc();
  if (nodeIpc) return createNodeIpcChannel(nodeIpc);
  throw new Error(NO_PARENT_CHANNEL_MESSAGE);
};
