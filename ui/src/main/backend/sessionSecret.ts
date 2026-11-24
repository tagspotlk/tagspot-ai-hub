import { randomBytes } from 'node:crypto';

const SECRET_BYTES = 32;

/** Creates the per-run secret that authenticates the UI to the backend (43 base64url chars). */
export function createSessionSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url');
}
