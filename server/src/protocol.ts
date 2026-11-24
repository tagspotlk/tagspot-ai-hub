/** Messages between the app's main process (parent) and the backend process. */
export type ParentToBackend = { type: 'init'; sessionSecret: string };

export type BackendToParent = { type: 'ready'; port: number } | { type: 'error'; message: string };

/** How often the backend checks that its parent is still alive; it exits within about this long after the parent dies. */
export const PARENT_CHECK_INTERVAL_MS = 2_000;
