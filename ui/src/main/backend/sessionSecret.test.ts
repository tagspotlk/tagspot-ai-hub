import { describe, expect, it } from 'vitest';
import { createSessionSecret } from './sessionSecret.ts';

const BASE64URL_43_CHARS = /^[A-Za-z0-9_-]{43}$/;

describe('createSessionSecret', () => {
  it('shouldReturn43CharBase64UrlSecret_whenCreated', () => {
    // Given / When
    const secret = createSessionSecret();
    // Then
    expect(secret).toMatch(BASE64URL_43_CHARS);
  });

  it('shouldReturnDifferentSecrets_whenCalledTwice', () => {
    // Given / When
    const first = createSessionSecret();
    const second = createSessionSecret();
    // Then
    expect(first).not.toBe(second);
  });
});
