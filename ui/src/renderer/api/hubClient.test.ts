import { describe, expect, it, vi } from 'vitest';
import type { ApiProxyRequest, ApiProxyResponse } from '../../main/ipc.ts';
import { createHubClient } from './hubClient.ts';

const STATUS_BODY = JSON.stringify({ state: 'running', version: '0.1.0' });

function fakeApiRequest() {
  return vi.fn<(request: ApiProxyRequest) => Promise<ApiProxyResponse>>(() =>
    Promise.resolve({ status: 200, body: STATUS_BODY, contentType: 'application/json' }),
  );
}

describe('createHubClient', () => {
  it('shouldSendRequestThroughApiRequest_whenRequestingStatus', async () => {
    // Given a client backed by a fake apiRequest
    const apiRequest = fakeApiRequest();
    const client = createHubClient(apiRequest);

    // When requesting the status
    await client.GET('/status');

    // Then apiRequest receives a GET for /status
    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/status' }),
    );
  });

  it('shouldReturnParsedStatus_whenProxyRespondsOk', async () => {
    // Given a proxy answering with a running status
    const client = createHubClient(fakeApiRequest());

    // When requesting the status
    const { data } = await client.GET('/status');

    // Then the parsed body is returned
    expect(data).toEqual({ state: 'running', version: '0.1.0' });
  });

  it('shouldReturnEmptyResponse_whenProxyRespondsNoContent', async () => {
    // Given a proxy answering 204 with an empty body
    const apiRequest = vi.fn<(request: ApiProxyRequest) => Promise<ApiProxyResponse>>(() =>
      Promise.resolve({ status: 204, body: '', contentType: null }),
    );
    const client = createHubClient(apiRequest);

    // When requesting the status
    const { response } = await client.GET('/status');

    // Then an empty 204 response is returned without throwing
    expect(response.status).toBe(204);
  });
});
