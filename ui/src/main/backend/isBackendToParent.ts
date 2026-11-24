import type { BackendToParent } from '@tagspot/server/protocol';

const MIN_PORT = 1;
const MAX_PORT = 65_535;

function isPort(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= MIN_PORT && (value as number) <= MAX_PORT;
}

/** Runtime check for messages from the backend process, which main must not trust blindly. */
export function isBackendToParent(value: unknown): value is BackendToParent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate['type'] === 'ready') return isPort(candidate['port']);
  if (candidate['type'] === 'error') return typeof candidate['message'] === 'string';
  return false;
}
