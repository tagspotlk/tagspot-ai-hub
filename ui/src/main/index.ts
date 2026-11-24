import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, app, ipcMain, utilityProcess, type IpcMainInvokeEvent } from 'electron';
import {
  IPC_API_REQUEST,
  IPC_GET_STATE,
  IPC_RESTART,
  IPC_STATE_CHANGED,
} from '../shared/ipcChannels.ts';
import { BackendSupervisor } from './backend/BackendSupervisor.ts';
import { UtilityProcessLauncher } from './backend/UtilityProcessLauncher.ts';
import { STARTUP_TIMEOUT_MS, STOP_TIMEOUT_MS } from './backend/backendState.ts';
import { resolveBackendEntry } from './backend/resolveBackendEntry.ts';
import { createSessionSecret } from './backend/sessionSecret.ts';
import { createApiProxy } from './apiProxy.ts';
import { type ApiProxyRequest, toRendererState } from './ipc.ts';
import { isTrustedSender } from './isTrustedSender.ts';
import { registerQuitHandler } from './quitHandler.ts';

const WINDOW_WIDTH = 1200;
const WINDOW_HEIGHT = 800;
const UNTRUSTED_SENDER_MESSAGE = 'IPC call from an untrusted page';

/** The app's own page: the electron-vite dev server in development, the built file otherwise. */
const RENDERER_URL =
  process.env['ELECTRON_RENDERER_URL'] ??
  pathToFileURL(join(import.meta.dirname, '../renderer/index.html')).href;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // The window only ever shows our page: no navigation away, no new windows.
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  void window.loadURL(RENDERER_URL);
  return window;
}

function createSupervisor(): BackendSupervisor {
  const launcher = new UtilityProcessLauncher({
    entryPath: resolveBackendEntry(),
    fork: utilityProcess.fork,
  });
  return new BackendSupervisor(launcher, {
    startupTimeoutMs: STARTUP_TIMEOUT_MS,
    stopTimeoutMs: STOP_TIMEOUT_MS,
    createSecret: createSessionSecret,
  });
}

/** Registers an invoke handler that rejects calls from any page other than ours. */
function handleTrusted(channel: string, handler: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!isTrustedSender(event.senderFrame?.url, RENDERER_URL))
      throw new Error(UNTRUSTED_SENDER_MESSAGE);
    return handler(...args);
  });
}

function wireIpc(supervisor: BackendSupervisor, window: BrowserWindow): void {
  handleTrusted(IPC_GET_STATE, () => toRendererState(supervisor));
  const apiProxy = createApiProxy(() => supervisor.getConnection(), fetch);
  // The proxy validates the untrusted renderer payload itself.
  handleTrusted(IPC_API_REQUEST, (request) => apiProxy(request as ApiProxyRequest));
  handleTrusted(IPC_RESTART, () => supervisor.restart());
  supervisor.onStateChange(() => {
    if (!window.isDestroyed())
      window.webContents.send(IPC_STATE_CHANGED, toRendererState(supervisor));
  });
}

void app.whenReady().then(() => {
  const supervisor = createSupervisor();
  wireIpc(supervisor, createWindow());
  registerQuitHandler(app, supervisor);
  supervisor.start();
});

app.on('window-all-closed', () => app.quit());
