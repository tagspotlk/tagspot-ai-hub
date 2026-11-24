import { API_METHODS, type ApiProxyRequest, type ApiProxyResponse } from './ipc.ts';

export const INVALID_REQUEST_MESSAGE = 'Invalid API request';
/** Must stay below the renderer's status poll interval. */
export const API_REQUEST_TIMEOUT_MS = 3_000;
export const REQUEST_TIMED_OUT_MESSAGE = 'Backend did not respond in time';
export const BACKEND_NOT_RUNNING_MESSAGE = 'Backend is not running';

interface ProxyConnection {
  port: number;
  sessionSecret: string;
}

/** A path is relative to the backend only if it starts with exactly one slash. */
function isRelativePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

function assertValid(request: ApiProxyRequest): void {
  const validMethod = (API_METHODS as readonly string[]).includes(request.method);
  if (!validMethod || !isRelativePath(request.path)) throw new Error(INVALID_REQUEST_MESSAGE);
}

function rethrowWithoutDetails(error: unknown): never {
  if (error instanceof DOMException && error.name === 'TimeoutError')
    throw new Error(REQUEST_TIMED_OUT_MESSAGE);
  throw error;
}

/** Forwards renderer requests to the loopback backend, adding the bearer secret in main only. */
export function createApiProxy(
  getConnection: () => ProxyConnection | null,
  fetchImpl: typeof fetch,
  timeoutMs: number = API_REQUEST_TIMEOUT_MS,
): (request: ApiProxyRequest) => Promise<ApiProxyResponse> {
  return async (request) => {
    assertValid(request);
    const connection = getConnection();
    if (!connection) throw new Error(BACKEND_NOT_RUNNING_MESSAGE);
    const headers = new Headers({ Authorization: `Bearer ${connection.sessionSecret}` });
    if (request.contentType) headers.set('Content-Type', request.contentType);
    const response = await fetchImpl(`http://127.0.0.1:${connection.port}${request.path}`, {
      method: request.method,
      headers,
      body: request.body,
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(rethrowWithoutDetails);
    return {
      status: response.status,
      body: await response.text(),
      contentType: response.headers.get('Content-Type'),
    };
  };
}
