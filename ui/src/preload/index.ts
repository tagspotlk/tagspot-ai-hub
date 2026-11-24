import { contextBridge, ipcRenderer } from 'electron';
import type { ApiProxyRequest, ApiProxyResponse, RendererBackendState } from '../main/ipc.ts';
import {
  IPC_API_REQUEST,
  IPC_GET_STATE,
  IPC_RESTART,
  IPC_STATE_CHANGED,
} from '../shared/ipcChannels.ts';

type StateListener = (state: RendererBackendState) => void;

contextBridge.exposeInMainWorld('hub', {
  getBackendState: (): Promise<RendererBackendState> => ipcRenderer.invoke(IPC_GET_STATE),
  restartBackend: (): Promise<void> => ipcRenderer.invoke(IPC_RESTART),
  apiRequest: (request: ApiProxyRequest): Promise<ApiProxyResponse> =>
    ipcRenderer.invoke(IPC_API_REQUEST, request),
  onBackendStateChange: (listener: StateListener): (() => void) => {
    const handler = (_event: unknown, state: RendererBackendState): void => listener(state);
    ipcRenderer.on(IPC_STATE_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_STATE_CHANGED, handler);
    };
  },
});
