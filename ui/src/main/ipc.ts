import type { BackendState } from './backend/backendState.ts';

export const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** A request the renderer asks main to forward to the local backend. */
export interface ApiProxyRequest {
  method: (typeof API_METHODS)[number];
  path: string;
  body: string | null;
  contentType: string | null;
}

export interface ApiProxyResponse {
  status: number;
  body: string;
  contentType: string | null;
}

/** Backend state as the renderer sees it: never the port or the session secret. */
export type RendererBackendState =
  Exclude<BackendState, { status: 'running' }> | { status: 'running' };

interface StateSource {
  getState(): BackendState;
}

export function toRendererState(source: StateSource): RendererBackendState {
  const state = source.getState();
  if (state.status === 'running') return { status: 'running' };
  return state;
}
