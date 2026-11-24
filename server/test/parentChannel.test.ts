import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PARENT_PORT_FLUSH_DELAY_MS,
  createNodeIpcChannel,
  createUtilityProcessChannel,
  type NodeIpc,
  type ParentPort,
} from '../src/channel/parentChannel.ts';

const ERROR_MESSAGE = { type: 'error', message: 'boom' } as const;

type SendCallback = (error: Error | null) => void;

function fakeNodeIpc() {
  const callbacks: SendCallback[] = [];
  const ipc: NodeIpc = {
    send: vi.fn((_message: unknown, callback: SendCallback) => {
      callbacks.push(callback);
      return true;
    }),
    on: vi.fn(),
  };
  return { ipc, callbacks };
}

function fakeParentPort(): ParentPort {
  return { on: vi.fn(), postMessage: vi.fn() };
}

const settledState = async (promise: Promise<void>): Promise<'pending' | 'resolved'> => {
  const pending = Symbol('pending');
  const winner = await Promise.race([promise.then(() => 'resolved' as const), pending]);
  return winner === pending ? 'pending' : 'resolved';
};

describe('createNodeIpcChannel', () => {
  it('shouldStayPending_whenSendNotYetFlushed', async () => {
    // Given a Node IPC channel whose send has not called back
    const { ipc } = fakeNodeIpc();
    const channel = createNodeIpcChannel(ipc);

    // When posting a message
    const posted = channel.postMessage(ERROR_MESSAGE);

    // Then the post is not reported as flushed yet
    expect(await settledState(posted)).toBe('pending');
  });

  it('shouldResolve_whenSendCallsBack', async () => {
    // Given a Node IPC channel
    const { ipc, callbacks } = fakeNodeIpc();
    const channel = createNodeIpcChannel(ipc);
    const posted = channel.postMessage(ERROR_MESSAGE);

    // When the send callback reports success
    callbacks[0]?.(null);

    // Then the post resolves
    await expect(posted).resolves.toBeUndefined();
  });

  it('shouldReject_whenSendCallsBackWithError', async () => {
    // Given a Node IPC channel
    const { ipc, callbacks } = fakeNodeIpc();
    const channel = createNodeIpcChannel(ipc);
    const posted = channel.postMessage(ERROR_MESSAGE);

    // When the send callback reports an error
    callbacks[0]?.(new Error('channel closed'));

    // Then the post rejects
    await expect(posted).rejects.toThrow('channel closed');
  });
});

describe('createUtilityProcessChannel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shouldStayPending_whenFlushDelayNotElapsed', async () => {
    // Given a utility-process channel
    const channel = createUtilityProcessChannel(fakeParentPort());

    // When posting a message
    const posted = channel.postMessage(ERROR_MESSAGE);

    // Then the post is not reported as flushed before the delay
    expect(await settledState(posted)).toBe('pending');
  });

  it('shouldResolve_whenFlushDelayElapsed', async () => {
    // Given a posted message on a utility-process channel
    const port = fakeParentPort();
    const posted = createUtilityProcessChannel(port).postMessage(ERROR_MESSAGE);

    // When the flush delay passes
    await vi.advanceTimersByTimeAsync(PARENT_PORT_FLUSH_DELAY_MS);

    // Then the message was handed to the port and the post resolves
    await expect(posted).resolves.toBeUndefined();
    expect(port.postMessage).toHaveBeenCalledWith(ERROR_MESSAGE);
  });
});
