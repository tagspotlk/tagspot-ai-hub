import { readFileSync } from 'node:fs';

/** `server/package.json`, one level above both `src/` and `dist/`, so it resolves from either. */
const SERVER_PACKAGE_JSON_URL = new URL('../package.json', import.meta.url);

/** Reads the backend's own version from `server/package.json`. */
export const readServerVersion = (packageJsonUrl: URL = SERVER_PACKAGE_JSON_URL): string => {
  const manifest = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as { version?: unknown };
  if (typeof manifest.version !== 'string' || manifest.version.length === 0)
    throw new Error('Server package.json has no version');
  return manifest.version;
};
