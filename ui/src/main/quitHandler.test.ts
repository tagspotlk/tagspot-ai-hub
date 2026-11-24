import { describe, expect, it, vi } from 'vitest';
import type { BackendState } from './backend/backendState.ts';
import { registerQuitHandler } from './quitHandler.ts';

type QuitListener = (event: { preventDefault(): void }) => void;

function setup(initialState: BackendState) {
  let state = initialState;
  let listener: QuitListener = () => {};
  const app = {
    on: (_event: 'before-quit', handler: QuitListener) => {
      listener = handler;
    },
    quit: vi.fn(),
  };
  const stop = vi.fn(async () => {
    state = { status: 'stopped', reason: 'quit' };
  });
  registerQuitHandler(app, { stop, getState: () => state });
  const fireBeforeQuit = () => {
    const event = { preventDefault: vi.fn() };
    listener(event);
    return event;
  };
  return { app, stop, fireBeforeQuit };
}

describe('registerQuitHandler', () => {
  it('shouldStopBackendBeforeQuitting_whenAppQuits', async () => {
    // Given
    const { app, stop, fireBeforeQuit } = setup({ status: 'running', port: 1 });
    // When
    const first = fireBeforeQuit();
    await vi.waitFor(() => expect(app.quit).toHaveBeenCalledTimes(1));
    const second = fireBeforeQuit();
    // Then
    expect(first.preventDefault).toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(second.preventDefault).not.toHaveBeenCalled();
  });

  it('shouldStopBackend_whenQuitWhileStarting', async () => {
    // Given
    const { app, stop, fireBeforeQuit } = setup({ status: 'starting' });
    // When
    const event = fireBeforeQuit();
    await vi.waitFor(() => expect(app.quit).toHaveBeenCalled());
    // Then
    expect(event.preventDefault).toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('shouldNotPreventQuit_whenBackendAlreadyStopped', () => {
    // Given
    const { stop, fireBeforeQuit } = setup({ status: 'stopped', reason: 'crashed' });
    // When
    const event = fireBeforeQuit();
    // Then
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });
});
