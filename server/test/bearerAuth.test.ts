import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { UNAUTHORIZED_ERROR } from '../src/auth/bearerAuth.ts';

const SESSION_SECRET = 'test-session-secret';
const STATUS_URL = '/status';
const HTTP_UNAUTHORIZED = 401;

const createApp = () => buildApp({ sessionSecret: SESSION_SECRET, version: '1.2.3' });

describe('bearer auth', () => {
  it('shouldRejectRequest_whenSecretMissing', async () => {
    // Given
    const app = createApp();

    // When
    const response = await app.inject({ method: 'GET', url: STATUS_URL });

    // Then
    expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
    expect(response.json()).toEqual(UNAUTHORIZED_ERROR);
  });

  it('shouldRejectRequest_whenSecretWrong', async () => {
    // Given
    const app = createApp();

    // When
    const response = await app.inject({
      method: 'GET',
      url: STATUS_URL,
      headers: { authorization: 'Bearer test-session-secreX' },
    });

    // Then
    expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
    expect(response.json()).toEqual(UNAUTHORIZED_ERROR);
  });

  it('shouldRejectRequest_whenSchemeIsNotBearer', async () => {
    // Given
    const app = createApp();

    // When
    const response = await app.inject({
      method: 'GET',
      url: STATUS_URL,
      headers: { authorization: `Basic ${SESSION_SECRET}` },
    });

    // Then
    expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
    expect(response.json()).toEqual(UNAUTHORIZED_ERROR);
  });

  it('shouldRejectRequest_whenTokenEmpty', async () => {
    // Given
    const app = createApp();

    // When
    const response = await app.inject({
      method: 'GET',
      url: STATUS_URL,
      headers: { authorization: 'Bearer ' },
    });

    // Then
    expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
    expect(response.json()).toEqual(UNAUTHORIZED_ERROR);
  });

  it('shouldRejectRequest_whenSecretLengthDiffers', async () => {
    // Given
    const app = createApp();

    // When
    const response = await app.inject({
      method: 'GET',
      url: STATUS_URL,
      headers: { authorization: 'Bearer short' },
    });

    // Then
    expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
    expect(response.json()).toEqual(UNAUTHORIZED_ERROR);
  });
});
