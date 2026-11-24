import { type ApiRequestFn, createHubClient } from '../api/hubClient.ts';
import { STATUS_CHECK_FAILED, type StatusCheck } from './deriveUiStatus.ts';

/** Calls GET /status through the typed client; the version shown comes from this response. */
export async function checkStatus(
  apiRequest: ApiRequestFn = window.hub.apiRequest,
): Promise<StatusCheck> {
  try {
    const { data } = await createHubClient(apiRequest).GET('/status');
    return data ? { kind: 'ok', version: data.version } : STATUS_CHECK_FAILED;
  } catch {
    // An unreachable backend is a failed check, which the UI shows as stopped.
    return STATUS_CHECK_FAILED;
  }
}
