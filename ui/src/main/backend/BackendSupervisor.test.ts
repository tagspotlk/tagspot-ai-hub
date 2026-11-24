import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeLauncher } from '../../../test/fakes/FakeLauncher.ts';
import {
  EXITED_DURING_STARTUP_MESSAGE,
  INVALID_MESSAGE_MESSAGE,
  BackendSupervisor,
} from './BackendSupervisor.ts';
import type { BackendState } from './backendState.ts';

const SECRET = 'test-secret'; // allow-secret: test fixture
const TIMEOUT_MS = 1_000;
const STOP_TIMEOUT_MS = 500;
const PORT = 5123;

function setup() {
  const launcher = new FakeLauncher();
  const supervisor = new BackendSupervisor(launcher, {
    startupTimeoutMs: TIMEOUT_MS,
    stopTimeoutMs: STOP_TIMEOUT_MS,
    createSecret: () => SECRET,
  });
  return { launcher, supervisor };
}

describe('BackendSupervisor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shouldSendInitWithSecret_whenStarted', () => {
    // Given
    const { launcher, supervisor } = setup();
    // When
    supervisor.start();
    // Then
    expect(launcher.launched[0]?.posted).toEqual([{ type: 'init', sessionSecret: SECRET }]);
  });

  it('shouldBeStarting_whenStartedAndNotReady', () => {
    // Given
    const { supervisor } = setup();
    // When
    supervisor.start();
    // Then
    expect(supervisor.getState()).toEqual({ status: 'starting' });
  });

  it('shouldBeRunning_whenReadyReceived', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When
    launcher.launched[0]?.emitMessage({ type: 'ready', port: PORT });
    // Then
    expect(supervisor.getState()).toEqual({ status: 'running', port: PORT });
  });

  it('shouldFailWithTimeout_whenNotReadyInTime', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When
    vi.advanceTimersByTime(TIMEOUT_MS);
    // Then
    expect(supervisor.getState()).toMatchObject({ status: 'failed', reason: 'timeout' });
    expect(launcher.launched[0]?.killed).toBe(true);
  });

  it('shouldIgnoreReady_whenItArrivesAfterTimeout', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    vi.advanceTimersByTime(TIMEOUT_MS);
    // When
    launcher.launched[0]?.emitMessage({ type: 'ready', port: PORT });
    // Then
    expect(supervisor.getState()).toMatchObject({ status: 'failed', reason: 'timeout' });
    expect(launcher.launched[0]?.killed).toBe(true);
  });

  it('shouldFailWithError_whenBackendReportsError', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When
    launcher.launched[0]?.emitMessage({ type: 'error', message: 'boom' });
    // Then
    expect(supervisor.getState()).toEqual({ status: 'failed', reason: 'error', message: 'boom' });
    expect(launcher.launched[0]?.killed).toBe(true);
  });

  it('shouldBeStoppedCrashed_whenProcessExitsUnexpectedly', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    launcher.launched[0]?.emitMessage({ type: 'ready', port: PORT });
    // When
    launcher.launched[0]?.emitExit(1);
    // Then
    expect(supervisor.getState()).toEqual({ status: 'stopped', reason: 'crashed' });
  });

  it('shouldFailWithStartupExitMessage_whenProcessExitsWhileStarting', () => {
    // Given a backend that has not reported ready
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When it exits
    launcher.launched[0]?.emitExit(1);
    // Then the failure says it exited during startup
    expect(supervisor.getState()).toEqual({
      status: 'failed',
      reason: 'error',
      message: EXITED_DURING_STARTUP_MESSAGE,
    });
  });

  it('shouldFailWithInvalidMessage_whenBackendSendsMalformedMessage', () => {
    // Given a starting backend
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When it sends a message that is not part of the protocol
    launcher.launched[0]?.emitMessage({ type: 'ready', port: 'not-a-port' });
    // Then the start fails with the fixed message and the process is killed
    expect(supervisor.getState()).toEqual({
      status: 'failed',
      reason: 'error',
      message: INVALID_MESSAGE_MESSAGE,
    });
    expect(launcher.launched[0]?.killed).toBe(true);
  });

  it('shouldStartNewProcess_whenRestartedAfterCrash', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    launcher.launched[0]?.emitExit(1);
    // When
    supervisor.restart();
    // Then
    expect(launcher.launched).toHaveLength(2);
    expect(supervisor.getState()).toEqual({ status: 'starting' });
  });

  it('shouldKeepOneProcess_whenRestartCalledTwiceQuickly', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When
    supervisor.restart();
    supervisor.restart();
    // Then
    expect(launcher.alive).toHaveLength(1);
  });

  it('shouldKeepOneProcess_whenRestartCalledWhileStarting', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When
    supervisor.restart();
    launcher.launched[0]?.emitExit(null);
    // Then
    expect(launcher.alive).toHaveLength(1);
    expect(supervisor.getState()).toEqual({ status: 'starting' });
  });

  it('shouldBeStoppedQuit_whenStopCalled', async () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    launcher.launched[0]?.emitMessage({ type: 'ready', port: PORT });
    // When
    const stopped = supervisor.stop();
    launcher.launched[0]?.emitExit(0);
    await stopped;
    // Then
    expect(supervisor.getState()).toEqual({ status: 'stopped', reason: 'quit' });
    expect(launcher.launched[0]?.killed).toBe(true);
  });

  it('shouldResolveImmediately_whenStopCalledWithoutProcess', async () => {
    // Given
    const { supervisor } = setup();
    // When
    await supervisor.stop();
    // Then
    expect(supervisor.getState()).toEqual({ status: 'stopped', reason: 'quit' });
  });

  it('shouldResolveStop_whenProcessNeverExits', async () => {
    // Given
    const { supervisor } = setup();
    supervisor.start();
    // When
    const stopped = supervisor.stop();
    await vi.advanceTimersByTimeAsync(STOP_TIMEOUT_MS);
    await stopped;
    // Then
    expect(supervisor.getState()).toEqual({ status: 'stopped', reason: 'quit' });
  });

  it('shouldResolveBothStops_whenStopCalledTwice', async () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When
    const first = supervisor.stop();
    const second = supervisor.stop();
    launcher.launched[0]?.emitExit(0);
    // Then
    await expect(Promise.all([first, second])).resolves.toBeDefined();
  });

  it('shouldJoinNewestStop_whenOlderStoppedProcessExits', () => {
    // Given two stops in flight, for an older and a newer process
    const { launcher, supervisor } = setup();
    supervisor.start();
    void supervisor.stop();
    supervisor.start();
    const newerStop = supervisor.stop();
    // When the older process exits and stop is called again without a process
    launcher.launched[0]?.emitExit(0);
    const joined = supervisor.stop();
    // Then the call joins the newer stop that is still in flight
    expect(joined).toBe(newerStop);
  });

  it('shouldStayStoppedQuit_whenProcessExitsAfterStop', async () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    const stopped = supervisor.stop();
    // When
    launcher.launched[0]?.emitExit(0);
    await stopped;
    // Then
    expect(supervisor.getState()).toEqual({ status: 'stopped', reason: 'quit' });
  });

  it('shouldNotifyListeners_whenStateChanges', () => {
    // Given
    const { supervisor } = setup();
    const seen: BackendState[] = [];
    supervisor.onStateChange((state) => seen.push(state));
    // When
    supervisor.start();
    // Then
    expect(seen).toEqual([{ status: 'starting' }]);
  });

  it('shouldStopNotifying_whenUnsubscribed', () => {
    // Given
    const { supervisor } = setup();
    const seen: BackendState[] = [];
    const unsubscribe = supervisor.onStateChange((state) => seen.push(state));
    unsubscribe();
    // When
    supervisor.start();
    // Then
    expect(seen).toEqual([]);
  });

  it('shouldReturnNullConnection_whenNotRunning', () => {
    // Given
    const { supervisor } = setup();
    // When
    supervisor.start();
    // Then
    expect(supervisor.getConnection()).toBeNull();
  });

  it('shouldReturnConnection_whenRunning', () => {
    // Given
    const { launcher, supervisor } = setup();
    supervisor.start();
    // When
    launcher.launched[0]?.emitMessage({ type: 'ready', port: PORT });
    // Then
    expect(supervisor.getConnection()).toEqual({ port: PORT, sessionSecret: SECRET });
  });
});
