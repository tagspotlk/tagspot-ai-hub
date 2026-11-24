import { describe, expect, it } from 'vitest';
import type { RendererBackendState } from '../../main/ipc.ts';
import { NO_CHECK, STATUS_CHECK_FAILED, deriveUiStatus } from './deriveUiStatus.ts';

const RUNNING: RendererBackendState = { status: 'running' };

describe('deriveUiStatus', () => {
  it('shouldBeRunningWithCheckedVersion_whenSupervisorRunningAndCheckOk', () => {
    // Given a running backend whose status check reported a version
    const check = { kind: 'ok', version: '0.1.0' } as const;

    // When deriving the UI status
    const status = deriveUiStatus(RUNNING, check);

    // Then it is running with the version from the status contract
    expect(status).toEqual({ kind: 'running', version: '0.1.0' });
  });

  it('shouldBeStopped_whenSupervisorRunningButCheckFailed', () => {
    // Given a running backend whose status check failed
    // When deriving the UI status
    const status = deriveUiStatus(RUNNING, STATUS_CHECK_FAILED);

    // Then it is stopped
    expect(status).toEqual({ kind: 'stopped' });
  });

  it('shouldBeStopped_whenSupervisorCrashed', () => {
    // Given a crashed backend
    const backend: RendererBackendState = { status: 'stopped', reason: 'crashed' };

    // When deriving the UI status
    const status = deriveUiStatus(backend, NO_CHECK);

    // Then it is stopped
    expect(status).toEqual({ kind: 'stopped' });
  });

  it('shouldBeFailed_whenSupervisorFailed', () => {
    // Given a backend that failed to start
    const backend: RendererBackendState = {
      status: 'failed',
      reason: 'timeout',
      message: 'did not start',
    };

    // When deriving the UI status
    const status = deriveUiStatus(backend, NO_CHECK);

    // Then it is failed with the message
    expect(status).toEqual({ kind: 'failed', message: 'did not start' });
  });

  it('shouldBeStarting_whenSupervisorStarting', () => {
    // Given a starting backend
    const backend: RendererBackendState = { status: 'starting' };

    // When deriving the UI status
    const status = deriveUiStatus(backend, NO_CHECK);

    // Then it is starting
    expect(status).toEqual({ kind: 'starting' });
  });

  it('shouldBeStarting_whenSupervisorRunningAndNoCheckYet', () => {
    // Given a running backend not yet checked
    // When deriving the UI status
    const status = deriveUiStatus(RUNNING, NO_CHECK);

    // Then it is still starting
    expect(status).toEqual({ kind: 'starting' });
  });
});
