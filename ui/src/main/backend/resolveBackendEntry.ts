import { createRequire } from 'node:module';

/** Absolute path of the built backend entry (`server/dist/main.js`). */
export function resolveBackendEntry(): string {
  return createRequire(import.meta.url).resolve('@tagspot/server/entry');
}
