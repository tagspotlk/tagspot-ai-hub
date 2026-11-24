/** Polls `isParentAlive` and calls `onGone` once when it turns false. Returns a function that stops the polling. */
export const watchParent = (
  isParentAlive: () => boolean,
  onGone: () => void,
  intervalMs: number,
): (() => void) => {
  const timer = setInterval(() => {
    if (isParentAlive()) return;
    clearInterval(timer);
    onGone();
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
};
