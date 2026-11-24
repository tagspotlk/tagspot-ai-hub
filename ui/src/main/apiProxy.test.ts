import { describe, expect, it, vi } from 'vitest';
import {
  BACKEND_NOT_RUNNING_MESSAGE,
  INVALID_REQUEST_MESSAGE,
  REQUEST_TIMED_OUT_MESSAGE,
  createApiProxy,
} from './apiProxy.ts';
import type { ApiProxyRequest } from './ipc.ts';

const SECRET = 'super-secret-value'; // allow-secret: test fixture
const PORT = 4242;
const SHORT_TIMEOUT_MS = 20;
const RUNNING = { port: PORT, sessionSecret: SECRET };

const statusRequest = (overrides: Partial<ApiProxyRequest> = {}): ApiProxyRequest => ({
  method: 'GET',
  path: '/status',
  body: null,
  contentType: null,
  ...overrides,
});

function fakeFetch() {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(Response.json({ state: 'running', version: '0.1.0' })),
  );
}

describe('createApiProxy', () => {
  it('shouldAddBearerSecret_whenForwardingRequest', async () => {
    // Given a running backend
    const fetchImpl = fakeFetch();
    const proxy = createApiProxy(() => RUNNING, fetchImpl);

    // When forwarding a request
    const response = await proxy(statusRequest());

    // Then the backend is called on loopback with the bearer secret
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`http://127.0.0.1:${PORT}/status`);
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(response.body).toContain('0.1.0');
  });

  it('shouldIgnoreRendererAuthorization_whenForwarding', async () => {
    // Given a request type that cannot carry headers, only contentType is forwarded
    const fetchImpl = fakeFetch();
    const proxy = createApiProxy(() => RUNNING, fetchImpl);

    // When forwarding a request carrying a content type
    await proxy(statusRequest({ method: 'POST', body: '{}', contentType: 'application/json' }));

    // Then only our bearer secret is sent as Authorization
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${SECRET}`);
  });

  it('shouldRejectRequest_whenPathIsAbsoluteUrl', async () => {
    // Given a proxy
    const proxy = createApiProxy(() => RUNNING, fakeFetch());

    // When the path is an absolute URL
    const result = proxy(statusRequest({ path: 'http://evil.example/status' }));

    // Then it is rejected
    await expect(result).rejects.toThrow(INVALID_REQUEST_MESSAGE);
  });

  it('shouldRejectRequest_whenPathStartsWithDoubleSlash', async () => {
    // Given a proxy
    const proxy = createApiProxy(() => RUNNING, fakeFetch());

    // When the path starts with two slashes
    const result = proxy(statusRequest({ path: '//evil.example/status' }));

    // Then it is rejected
    await expect(result).rejects.toThrow(INVALID_REQUEST_MESSAGE);
  });

  it('shouldRejectRequest_whenMethodNotAllowed', async () => {
    // Given a proxy
    const proxy = createApiProxy(() => RUNNING, fakeFetch());

    // When the method is not in the allowed list
    const result = proxy(statusRequest({ method: 'TRACE' as ApiProxyRequest['method'] }));

    // Then it is rejected
    await expect(result).rejects.toThrow(INVALID_REQUEST_MESSAGE);
  });

  it('shouldRejectRequest_whenBackendNotRunning', async () => {
    // Given no backend connection
    const proxy = createApiProxy(() => null, fakeFetch());

    // When forwarding a request
    const result = proxy(statusRequest());

    // Then it is rejected
    await expect(result).rejects.toThrow(BACKEND_NOT_RUNNING_MESSAGE);
  });

  it('shouldNotIncludeSecret_inErrorMessage', async () => {
    // Given a backend that is unreachable
    const failingFetch = vi.fn<typeof fetch>(() => Promise.reject(new Error('connect refused')));
    const proxy = createApiProxy(() => RUNNING, failingFetch);

    // When the forwarded call fails and the request is invalid
    const failures = [proxy(statusRequest({ path: '//x' })), proxy(statusRequest())];
    const messages = (await Promise.allSettled(failures)).map((r) =>
      r.status === 'rejected' ? String(r.reason) : '',
    );

    // Then no error message contains the secret
    expect(messages.join(' ')).not.toContain(SECRET);
  });

  it('shouldRejectRequest_whenBackendDoesNotRespondInTime', async () => {
    // Given a backend that never answers but honors the abort signal
    const hangingFetch = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const proxy = createApiProxy(() => RUNNING, hangingFetch, SHORT_TIMEOUT_MS);

    // When the request exceeds the timeout
    const result = proxy(statusRequest());

    // Then the request is rejected with the fixed timeout message
    await expect(result).rejects.toThrow(REQUEST_TIMED_OUT_MESSAGE);
  });
});
