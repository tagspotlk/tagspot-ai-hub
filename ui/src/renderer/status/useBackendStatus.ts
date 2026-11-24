import { useEffect, useState } from 'react';
import type { RendererBackendState } from '../../main/ipc.ts';
import { checkStatus } from './checkStatus.ts';
import { NO_CHECK, type StatusCheck, type UiStatus, deriveUiStatus } from './deriveUiStatus.ts';
import { startPolling } from './statusPolling.ts';

export const STATE_UNAVAILABLE_MESSAGE = 'Could not read the backend state';

function useBackendState(): RendererBackendState | null {
  const [backend, setBackend] = useState<RendererBackendState | null>(null);
  useEffect(() => {
    let pushReceived = false;
    const unsubscribe = window.hub.onBackendStateChange((state) => {
      pushReceived = true;
      setBackend(state);
    });
    window.hub
      .getBackendState()
      .then((state) => {
        // A pushed state is newer than the initial read.
        if (!pushReceived) setBackend(state);
      })
      .catch(() => {
        if (!pushReceived)
          setBackend({ status: 'failed', reason: 'error', message: STATE_UNAVAILABLE_MESSAGE });
      });
    return unsubscribe;
  }, []);
  return backend;
}

function useStatusCheck(running: boolean): StatusCheck {
  const [check, setCheck] = useState<StatusCheck>(NO_CHECK);
  useEffect(() => {
    setCheck(NO_CHECK);
    if (!running) return;
    return startPolling(() => checkStatus(), setCheck);
  }, [running]);
  return check;
}

/** Combines supervisor state pushed over IPC with polled GET /status results. */
export function useBackendStatus(): UiStatus {
  const backend = useBackendState();
  const check = useStatusCheck(backend?.status === 'running');
  return backend ? deriveUiStatus(backend, check) : { kind: 'starting' };
}
