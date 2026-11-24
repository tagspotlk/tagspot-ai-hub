import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readServerVersion } from '../src/serverVersion.ts';

const PACKAGE_JSON_URL = new URL('../package.json', import.meta.url);
const EXPECTED_VERSION = (JSON.parse(readFileSync(PACKAGE_JSON_URL, 'utf8')) as { version: string })
  .version;

describe('readServerVersion', () => {
  it('shouldReturnServerPackageVersion_whenRead', () => {
    // Given the server package.json
    // When reading the server version
    const version = readServerVersion();

    // Then it is the version declared in server/package.json
    expect(version).toBe(EXPECTED_VERSION);
  });
});
