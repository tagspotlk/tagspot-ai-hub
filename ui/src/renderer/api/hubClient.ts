import type { paths } from '@tagspot/api';
import createClient from 'openapi-fetch';
import type { ApiProxyRequest, ApiProxyResponse } from '../../main/ipc.ts';

/** Placeholder origin: only the path is used, main decides where the backend is. */
export const RENDERER_API_BASE_URL = 'http://hub.invalid';

export type ApiRequestFn = (request: ApiProxyRequest) => Promise<ApiProxyResponse>;

/** Statuses for which the Response constructor rejects any body. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

async function toProxyRequest(request: Request): Promise<ApiProxyRequest> {
  const url = new URL(request.url);
  const body = request.body ? await request.text() : null;
  return {
    method: request.method as ApiProxyRequest['method'],
    path: `${url.pathname}${url.search}`,
    body,
    contentType: request.headers.get('Content-Type'),
  };
}

/** A fetch that sends every request through main, so the renderer never sees port or secret. */
function createProxyFetch(apiRequest: ApiRequestFn): typeof fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const result = await apiRequest(await toProxyRequest(request));
    const hasBody = !NULL_BODY_STATUSES.has(result.status);
    return new Response(hasBody ? result.body : null, {
      status: result.status,
      ...(result.contentType ? { headers: { 'Content-Type': result.contentType } } : {}),
    });
  };
}

/** Typed client for the local REST API, backed by the IPC proxy. */
export function createHubClient(apiRequest: ApiRequestFn = window.hub.apiRequest) {
  return createClient<paths>({
    baseUrl: RENDERER_API_BASE_URL,
    fetch: createProxyFetch(apiRequest),
  });
}
