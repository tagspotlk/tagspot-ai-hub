import type { ApiProxyRequest, ApiProxyResponse, RendererBackendState } from '../main/ipc.ts';

/** The API the preload script exposes on `window.hub`. */
export interface HubBridge {
  getBackendState(): Promise<RendererBackendState>;
  onBackendStateChange(listener: (state: RendererBackendState) => void): () => void;
  restartBackend(): Promise<void>;
  apiRequest(request: ApiProxyRequest): Promise<ApiProxyResponse>;
}

declare global {
  interface Window {
    hub: HubBridge;
  }
}
