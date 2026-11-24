import { defineConfig } from '@playwright/test';
import { STARTUP_TIMEOUT_MS } from './src/main/backend/backendState.ts';

const TIMEOUT_MARGIN_MS = 30_000;

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: STARTUP_TIMEOUT_MS + TIMEOUT_MARGIN_MS,
  reporter: 'list',
});
