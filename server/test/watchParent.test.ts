import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchParent } from '../src/watchParent.ts';

const INTERVAL_MS = 2_000;

describe('watchParent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shouldCallOnGone_whenParentStopsBeingAlive', () => {
    // Given
    const onGone = vi.fn();
    const isParentAlive = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    watchParent(isParentAlive, onGone, INTERVAL_MS);

    // When
    vi.advanceTimersByTime(INTERVAL_MS * 2);

    // Then
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it('shouldNotCallOnGone_whenParentAlive', () => {
    // Given
    const onGone = vi.fn();
    watchParent(() => true, onGone, INTERVAL_MS);

    // When
    vi.advanceTimersByTime(INTERVAL_MS * 5);

    // Then
    expect(onGone).not.toHaveBeenCalled();
  });

  it('shouldStopChecking_whenStopCalled', () => {
    // Given
    const onGone = vi.fn();
    const stop = watchParent(() => false, onGone, INTERVAL_MS);

    // When
    stop();
    vi.advanceTimersByTime(INTERVAL_MS * 5);

    // Then
    expect(onGone).not.toHaveBeenCalled();
  });
});
