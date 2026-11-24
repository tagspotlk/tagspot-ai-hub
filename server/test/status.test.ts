import { validateResponse } from '@tagspot/api/contract-testing';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';

const SESSION_SECRET = 'test-session-secret';
const STATUS_URL = '/status';
const STATUS_PATH = '/status';
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const VERSION = '1.2.3';
const VALID_HEADERS = { authorization: `Bearer ${SESSION_SECRET}` };

const createApp = () => buildApp({ sessionSecret: SESSION_SECRET, version: VERSION });

describe('status route', () => {
  it('shouldReturnStatus_whenSecretValid', async () => {
    // Given
    const app = createApp();

    // When
    const response = await app.inject({ method: 'GET', url: STATUS_URL, headers: VALID_HEADERS });

    // Then
    expect(response.statusCode).toBe(HTTP_OK);
    expect(response.json()).toEqual({ state: 'running', version: VERSION });
  });

  it('shouldMatchContract_whenStatusReturns200', async () => {
    // Given
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: STATUS_URL, headers: VALID_HEADERS });

    // When
    const result = await validateResponse({
      path: STATUS_PATH,
      method: 'get',
      status: response.statusCode,
      body: response.json(),
    });

    // Then
    expect(response.statusCode).toBe(HTTP_OK);
    expect(result.valid).toBe(true);
  });

  it('shouldMatchContract_whenStatusReturns401', async () => {
    // Given
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: STATUS_URL });

    // When
    const result = await validateResponse({
      path: STATUS_PATH,
      method: 'get',
      status: response.statusCode,
      body: response.json(),
    });

    // Then
    expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
    expect(result.valid).toBe(true);
  });
});
