import { fileURLToPath } from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import { validateResponse } from '../src/contractTesting.ts';

const OPENAPI_PATH = fileURLToPath(new URL('../openapi.yaml', import.meta.url));
const STATUS_PATH = '/status';
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;

describe('openapi contract', () => {
  it('shouldBeValidOpenApiDocument_whenContractIsParsed', async () => {
    // Given
    const contractPath = OPENAPI_PATH;

    // When
    const validation = SwaggerParser.validate(contractPath);

    // Then
    await expect(validation).resolves.toBeDefined();
  });

  it('shouldAcceptStatusBody_whenItMatchesContract', async () => {
    // Given
    const body = { state: 'running', version: '0.1.0' };

    // When
    const result = await validateResponse({
      path: STATUS_PATH,
      method: 'get',
      status: HTTP_OK,
      body,
    });

    // Then
    expect(result.valid).toBe(true);
  });

  it('shouldRejectStatusBody_whenVersionMissing', async () => {
    // Given
    const body = { state: 'running' };

    // When
    const result = await validateResponse({
      path: STATUS_PATH,
      method: 'get',
      status: HTTP_OK,
      body,
    });

    // Then
    expect(result.valid).toBe(false);
  });

  it('shouldAcceptErrorBody_whenStatusIs401', async () => {
    // Given
    const body = { code: 'unauthorized', message: 'x' };

    // When
    const result = await validateResponse({
      path: STATUS_PATH,
      method: 'get',
      status: HTTP_UNAUTHORIZED,
      body,
    });

    // Then
    expect(result.valid).toBe(true);
  });

  it('shouldReportInvalid_whenResponseNotInContract', async () => {
    // Given
    const unknownPath = '/not-in-contract';

    // When
    const result = await validateResponse({
      path: unknownPath,
      method: 'get',
      status: HTTP_OK,
      body: {},
    });

    // Then
    expect(result.valid).toBe(false);
    expect(result.errors).not.toHaveLength(0);
  });
});
