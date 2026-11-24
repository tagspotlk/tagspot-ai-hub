import { describe, expect, it, vi } from 'vitest';
import type { ApiProxyRequest, ApiProxyResponse } from '../../main/ipc.ts';
import { checkStatus } from './checkStatus.ts';
import { STATUS_CHECK_FAILED } from './deriveUiStatus.ts';

type ApiRequest = (request: ApiProxyRequest) => Promise<ApiProxyResponse>;

const respondWith = (status: number, body: string) =>
  vi.fn<ApiRequest>(() => Promise.resolve({ status, body, contentType: 'application/json' }));

describe('checkStatus', () => {
  it('shouldReturnVersionFromStatusResponse_whenBackendAnswersOk', async () => {
    // Given a backend answering GET /status with its version
    const apiRequest = respondWith(200, JSON.stringify({ state: 'running', version: '2.3.4' }));

    // When checking the status
    const result = await checkStatus(apiRequest);

    // Then the version comes from the status response
    expect(result).toEqual({ kind: 'ok', version: '2.3.4' });
  });

  it('shouldFail_whenBackendAnswersUnauthorized', async () => {
    // Given a backend answering 401
    const apiRequest = respondWith(401, JSON.stringify({ code: 'unauthorized', message: 'no' }));

    // When checking the status
    const result = await checkStatus(apiRequest);

    // Then the check failed
    expect(result).toEqual(STATUS_CHECK_FAILED);
  });

  it('shouldFail_whenProxyRejects', async () => {
    // Given a proxy that cannot reach the backend
    const apiRequest = vi.fn<ApiRequest>(() => Promise.reject(new Error('Backend is not running')));

    // When checking the status
    const result = await checkStatus(apiRequest);

    // Then the check failed
    expect(result).toEqual(STATUS_CHECK_FAILED);
  });
});
