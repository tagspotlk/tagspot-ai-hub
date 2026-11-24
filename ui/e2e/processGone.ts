const POLL_INTERVAL_MS = 100;
export const DEFAULT_GONE_TIMEOUT_MS = 5_000;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    // kill(pid, 0) throws exactly when no such process exists.
    return false;
  }
}

/** Polls until the process no longer exists; resolves false if it outlives `timeoutMs`. */
export async function waitUntilProcessGone(
  pid: number,
  timeoutMs: number = DEFAULT_GONE_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (isAlive(pid)) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return true;
}
