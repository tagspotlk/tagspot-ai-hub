export const STATUS_POLL_INTERVAL_MS = 5_000;

/**
 * Runs `check` now and then again one interval after each run settles, so
 * checks never overlap even when one hangs. Returns a stop function.
 */
export function startPolling<T>(
  check: () => Promise<T>,
  onResult: (result: T) => void,
  intervalMs: number = STATUS_POLL_INTERVAL_MS,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (): void => {
    void check().then((result) => {
      if (stopped) return;
      onResult(result);
      timer = setTimeout(run, intervalMs);
    });
  };
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
