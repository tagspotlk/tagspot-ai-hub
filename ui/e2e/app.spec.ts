import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { PARENT_CHECK_INTERVAL_MS } from '@tagspot/server/protocol';
import { STARTUP_TIMEOUT_MS } from '../src/main/backend/backendState.ts';
import { BACKEND_SERVICE_NAME } from '../src/main/backend/UtilityProcessLauncher.ts';
import { DEFAULT_GONE_TIMEOUT_MS, waitUntilProcessGone } from './processGone.ts';

const MAIN_ENTRY = fileURLToPath(new URL('../out/main/index.js', import.meta.url));
const RUNNING_TEXT = /Backend running · v/;
const STOPPED_TEXT = 'Backend stopped';
const RESTART_BUTTON = 'Restart';
/** Time for the OS to reap the backend once it notices its parent is gone. */
const PARENT_GONE_MARGIN_MS = 3_000;
const ALREADY_CLOSED_ERROR = /closed|has exited|killed/i;

let electronApp: ElectronApplication;

test.beforeEach(async () => {
  electronApp = await electron.launch({ args: [MAIN_ENTRY] });
});

// Guarantees no Electron process outlives a failed test. Only an app that is already
// gone (e.g. killed by the test) is tolerated; any other close failure is reported.
test.afterEach(async () => {
  await electronApp.close().catch((error: unknown) => {
    if (error instanceof Error && ALREADY_CLOSED_ERROR.test(error.message)) return;
    throw error;
  });
});

async function waitUntilRunning(): Promise<void> {
  const window = await electronApp.firstWindow();
  await expect(window.getByText(RUNNING_TEXT)).toBeVisible({ timeout: STARTUP_TIMEOUT_MS });
}

async function findBackendPids(): Promise<number[]> {
  return electronApp.evaluate(
    ({ app }, processName) =>
      app
        .getAppMetrics()
        .filter((metric) => metric.type === 'Utility' && metric.name === processName)
        .map((metric) => metric.pid),
    BACKEND_SERVICE_NAME,
  );
}

test('shouldShowRunningAndLeaveNoBackend_whenAppStartsAndQuits', async () => {
  // Given: the built app is launched (beforeEach)
  // When: the window reports the backend as running, then the app quits
  await waitUntilRunning();
  const backendPids = await findBackendPids();
  await electronApp.close();

  // Then: a backend was found and its process is gone
  expect(backendPids).toHaveLength(1);
  await expect(waitUntilProcessGone(backendPids[0]!)).resolves.toBe(true);
});

test('shouldShowStoppedAndRecover_whenBackendCrashesAndUserRestarts', async () => {
  // Given: the backend is running
  await waitUntilRunning();
  const [backendPid] = await findBackendPids();
  const window = await electronApp.firstWindow();

  // When: the backend process dies and the user clicks Restart
  process.kill(backendPid!);
  await expect(window.getByText(STOPPED_TEXT)).toBeVisible({ timeout: DEFAULT_GONE_TIMEOUT_MS });
  await window.getByRole('button', { name: RESTART_BUTTON }).click();

  // Then: the backend is running again
  await expect(window.getByText(RUNNING_TEXT)).toBeVisible({ timeout: STARTUP_TIMEOUT_MS });
});

test('shouldStopBackend_whenAppProcessIsKilled', async () => {
  // Given: the backend is running
  await waitUntilRunning();
  const [backendPid] = await findBackendPids();
  // On Windows `electronApp.process()` is a cmd.exe wrapper, so ask Electron for its own pid.
  const mainPid = await electronApp.evaluate(() => process.pid);

  // When: the app's main process is killed without a chance to clean up
  process.kill(mainPid);

  // Then: the backend notices its parent is gone and exits
  const goneTimeoutMs = PARENT_CHECK_INTERVAL_MS + PARENT_GONE_MARGIN_MS;
  await expect(waitUntilProcessGone(backendPid!, goneTimeoutMs)).resolves.toBe(true);
});
