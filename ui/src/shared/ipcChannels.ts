// IPC channel names shared by main and preload. Constants only, no imports:
// the sandboxed preload bundle must not pull in anything but `electron`.
export const IPC_GET_STATE = 'backend:get-state';
export const IPC_STATE_CHANGED = 'backend:state-changed';
export const IPC_RESTART = 'backend:restart';
export const IPC_API_REQUEST = 'backend:api-request';
