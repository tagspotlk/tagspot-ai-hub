import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATUS_POLL_INTERVAL_MS, startPolling } from './statusPolling.ts';

describe('startPolling', () => {
  afterEach(() => vi.useRealTimers());

  it('shouldNotStartSecondCheck_whenFirstCheckStillPending', async () => {
    // Given a check that never settles
    vi.useFakeTimers();
    const check = vi.fn(() => new Promise<string>(() => undefined));
    const stop = startPolling(check, vi.fn());

    // When several intervals pass
    await vi.advanceTimersByTimeAsync(STATUS_POLL_INTERVAL_MS * 3);

    // Then only the first check was started
    expect(check).toHaveBeenCalledTimes(1);
    stop();
  });

  it('shouldCheckAgainAfterInterval_whenCheckSettled', async () => {
    // Given a check that settles immediately
    vi.useFakeTimers();
    const check = vi.fn(() => Promise.resolve('ok'));
    const stop = startPolling(check, vi.fn());

    // When one interval passes
    await vi.advanceTimersByTimeAsync(STATUS_POLL_INTERVAL_MS);

    // Then a second check ran
    expect(check).toHaveBeenCalledTimes(2);
    stop();
  });
});
