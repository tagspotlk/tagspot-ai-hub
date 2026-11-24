import { describe, expect, it } from 'vitest';
import type { BackendState } from './backend/backendState.ts';
import { toRendererState } from './ipc.ts';

describe('toRendererState', () => {
  it('shouldNotExposeSecretOrPort_whenRunning', () => {
    // Given a running backend with a port
    const state: BackendState = { status: 'running', port: 4242 };

    // When building the renderer state
    const rendererState = toRendererState({ getState: () => state });

    // Then only the status is present
    expect(rendererState).toEqual({ status: 'running' });
  });
});
