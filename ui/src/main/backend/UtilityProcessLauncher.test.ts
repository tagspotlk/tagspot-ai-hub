import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { UtilityProcessLauncher, type ForkFunction } from './UtilityProcessLauncher.ts';

const ENTRY_PATH = '/app/server/dist/main.js';
const SECRET = 'super-secret-value'; // allow-secret: test fixture

class FakeChild extends EventEmitter {
  posted: unknown[] = [];
  killed = false;
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  kill(): boolean {
    this.killed = true;
    return true;
  }
}

function setup() {
  const child = new FakeChild();
  const fork = vi.fn(() => child);
  const launcher = new UtilityProcessLauncher({
    entryPath: ENTRY_PATH,
    fork: fork as unknown as ForkFunction,
  });
  return { child, fork, launcher };
}

describe('UtilityProcessLauncher', () => {
  it('shouldForkWithoutSecretInArgsOrEnv_whenLaunched', () => {
    // Given
    const { fork, launcher } = setup();
    // When
    const process = launcher.launch();
    process.postMessage({ type: 'init', sessionSecret: SECRET });
    // Then
    const [path, args, options] = fork.mock.calls[0] as unknown as [
      string,
      string[],
      { env?: Record<string, string> },
    ];
    expect(path).toBe(ENTRY_PATH);
    expect(JSON.stringify(args)).not.toContain(SECRET);
    expect(JSON.stringify(options?.env ?? {})).not.toContain(SECRET);
  });

  it('shouldDeliverInitThroughPostMessage_whenPosted', () => {
    // Given
    const { child, launcher } = setup();
    const process = launcher.launch();
    // When
    process.postMessage({ type: 'init', sessionSecret: SECRET });
    // Then
    expect(child.posted).toEqual([{ type: 'init', sessionSecret: SECRET }]);
  });

  it('shouldForwardBackendMessages_whenChildEmitsMessage', () => {
    // Given
    const { child, launcher } = setup();
    const handler = vi.fn();
    launcher.launch().onMessage(handler);
    // When
    child.emit('message', { type: 'ready', port: 5123 });
    // Then
    expect(handler).toHaveBeenCalledWith({ type: 'ready', port: 5123 });
  });

  it('shouldForwardExitCode_whenChildExits', () => {
    // Given
    const { child, launcher } = setup();
    const handler = vi.fn();
    launcher.launch().onExit(handler);
    // When
    child.emit('exit', 3);
    // Then
    expect(handler).toHaveBeenCalledWith(3);
  });

  it('shouldKillChild_whenKillCalled', () => {
    // Given
    const { child, launcher } = setup();
    const process = launcher.launch();
    // When
    process.kill();
    // Then
    expect(child.killed).toBe(true);
  });
});
