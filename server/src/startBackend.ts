import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import type { ParentChannel } from './channel/parentChannel.ts';
import { PARENT_CHECK_INTERVAL_MS, type ParentToBackend } from './protocol.ts';
import { readServerVersion } from './serverVersion.ts';
import { watchParent } from './watchParent.ts';

export const INIT_TIMEOUT_MS = 5_000;
const LOOPBACK_HOST = '127.0.0.1';
const OS_CHOSEN_PORT = 0;
const EXIT_OK = 0;
const EXIT_ERROR = 1;

const isParentAlive = (): boolean => {
  try {
    process.kill(process.ppid, 0);
    return true;
  } catch {
    return false;
  }
};

const isValidInit = (message: unknown): message is ParentToBackend => {
  const candidate = message as Partial<ParentToBackend> | null;
  return (
    candidate?.type === 'init' &&
    typeof candidate.sessionSecret === 'string' &&
    candidate.sessionSecret.length > 0
  );
};

const waitForInit = (channel: ParentChannel): Promise<ParentToBackend> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No init message received')), INIT_TIMEOUT_MS);
    channel.onMessage((message) => {
      clearTimeout(timer);
      if (isValidInit(message)) resolve(message);
      else reject(new Error('Invalid init message'));
    });
  });

const listenOnLoopback = async (app: FastifyInstance): Promise<number> => {
  await app.listen({ host: LOOPBACK_HOST, port: OS_CHOSEN_PORT });
  const address = app.server.address();
  if (address === null || typeof address === 'string')
    throw new Error('Backend has no TCP address');
  return address.port;
};

/** Reports the failure and exits only after the message is flushed, so the parent learns the reason. */
const failAndExit = async (channel: ParentChannel, error: unknown): Promise<void> => {
  // Only our own fixed messages or Node error text reach the parent; the secret is never interpolated.
  const message = error instanceof Error ? error.message : 'Backend failed to start';
  try {
    await channel.postMessage({ type: 'error', message });
  } finally {
    process.exit(EXIT_ERROR);
  }
};

/** Waits for init, serves on loopback, reports the port, and exits when the parent goes away. */
export const startBackend = async (channel: ParentChannel): Promise<void> => {
  let app: FastifyInstance | undefined;
  let stopWatching = (): void => undefined;
  const shutdown = async (): Promise<void> => {
    stopWatching();
    await app?.close();
    process.exit(EXIT_OK);
  };
  channel.onClose(() => void shutdown());
  try {
    const init = await waitForInit(channel);
    app = buildApp({ sessionSecret: init.sessionSecret, version: readServerVersion() });
    const port = await listenOnLoopback(app);
    stopWatching = watchParent(isParentAlive, () => void shutdown(), PARENT_CHECK_INTERVAL_MS);
    await channel.postMessage({ type: 'ready', port });
  } catch (error) {
    await failAndExit(channel, error);
  }
};
