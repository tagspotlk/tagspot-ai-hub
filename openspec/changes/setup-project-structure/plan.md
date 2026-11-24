# Setup Project Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. After each task, tick the matching items in `tasks.md` (mapping given per task).

**Goal:** A Node/TS monorepo where the Electron app starts a protected local Fastify backend in a separate process and shows its status through an OpenAPI-generated client.

**Architecture:** npm workspaces `api` (contract + generated types + contract-test helpers), `server` (Fastify, no Electron imports, talks to its parent over a message channel), `ui` (electron-vite: main process supervises the backend through a `ProcessLauncher` adapter; React renderer reads status through `openapi-fetch`).

**Tech Stack:** Node ≥ 24, npm workspaces, TypeScript (strict), Electron + electron-vite, React, Fastify, openapi-typescript, openapi-fetch, Vitest, Playwright, ESLint (typescript-eslint), Prettier.

**Spec:** `openspec/changes/setup-project-structure/` — `proposal.md`, `design.md`, `specs/backend-lifecycle/spec.md`, `specs/system-status/spec.md`. Read `design.md` before starting.

## Global Constraints

- Node `>=24` in root `engines`; all packages `"type": "module"`.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
- Backend binds `127.0.0.1` only, port `0`.
- `STARTUP_TIMEOUT_MS = 15_000`; `STATUS_POLL_INTERVAL_MS = 5_000`; `PARENT_CHECK_INTERVAL_MS = 2_000`; session secret = 32 random bytes, base64url.
- The session secret never appears in process arguments, environment variables, logs or error messages.
- `server/` must not import `electron`.
- Electron window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Tests: Given / When / Then comments; names like `shouldRejectRequest_whenSecretMissing`; one behavior per test; no loops or ifs; mock only boundaries (process, network, timers).
- Named constants, no magic numbers or strings. Functions ≈ 20 lines, ≤ 3–4 params.
- **Commits:** never commit without the user's explicit permission. Each task ends by staging and proposing a Conventional Commit message, then waiting.
- **Dependencies:** only those in `design.md` plus the test/support packages listed per task (flagged as *extra* — confirm with the user before apply).

## Review Focus

1. Malformed `Authorization` header (wrong scheme, empty token, extra spaces, wrong-length secret) → 401 with the contract error body, never 500. *Test in Task 3.*
2. A `ready` message arriving after the startup timeout already fired → ignored, stray process killed, state stays `failed`. *Test in Task 5.*
3. Restart triggered twice quickly, or while `starting` → exactly one backend process alive. *Test in Task 5.*
4. Quit while the backend is still `starting` → process stopped, no orphan. *Test in Task 6.*
5. Backend receives no `init`, or an `init` without a secret → it never listens and exits non-zero. *Test in Task 4.*

---

### Task 1: Workspace and tooling

`tasks.md`: 1.1–1.4

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `.gitignore`, `.nvmrc` (`24`), `packaging/README.md`
- Create: `api/package.json`, `server/package.json`, `ui/package.json` (names `@tagspot/api`, `@tagspot/server`, `@tagspot/ui`), each with an empty `src/` and its own `vitest.config.ts`
- Create: `api/test/smoke.test.ts` (temporary; removed in Task 2)

**Interfaces:**
- Produces: root scripts `build` (`npm run build --workspaces --if-present`), `test` (`vitest run`), `test:e2e` (`npm run test:e2e -w @tagspot/ui`), `lint` (`eslint . && prettier --check .`), `format`, `dev` (`npm run dev -w @tagspot/ui`). Root `vitest.config.ts` uses `test.projects: ['api', 'server', 'ui']`.

- [ ] **Step 1:** Write root and workspace `package.json` files, `tsconfig.base.json` (strict, `target: ES2022`, `module/moduleResolution: NodeNext`, `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` so Node 24 can run `.ts` sources directly), lint/format configs, `.gitignore` (`node_modules`, `dist`, `out`, `api/src/generated`, `test-results`, `playwright-report`).
- [ ] **Step 2:** Run `npm install` from the root. Expected: exits 0, one root `package-lock.json`.
- [ ] **Step 3:** Add `api/test/smoke.test.ts` (`shouldRunTests_whenWorkspaceIsSetUp`, asserts `true`). Run `npm test`. Expected: 1 passed.
- [ ] **Step 4:** Run `npm run lint`. Expected: exits 0.
- [ ] **Step 5:** Write `packaging/README.md`: installer and signing are a later change; the hub needs no JRE.
- [ ] **Step 6:** Stage, propose `build: set up npm workspaces and tooling`, wait for permission.

---

### Task 2: API contract and contract-test helpers

`tasks.md`: 2.1, 2.2

*Extra deps:* `@apidevtools/swagger-parser`, `ajv` (dev, in `api`).

**Files:**
- Create: `api/openapi.yaml`, `api/src/index.ts`, `api/src/contractTesting.ts`, `api/test/openapi.test.ts`
- Delete: `api/test/smoke.test.ts`

**Interfaces:**
- Produces (types, from `@tagspot/api`): `paths`, `components` (generated into `api/src/generated/schema.d.ts`); `type StatusResponse = components['schemas']['StatusResponse']`; `type ErrorResponse = components['schemas']['ErrorResponse']`.
- Produces (`@tagspot/api/contract-testing`): `validateResponse(input: { path: string; method: 'get'; status: number; body: unknown }): Promise<{ valid: boolean; errors: string[] }>`.
- Contract (OpenAPI `3.1.0`): `GET /status`, security `bearerAuth` (HTTP bearer). `200` → `StatusResponse { state: 'running'; version: string }` (both required, `additionalProperties: false`). `401` → `ErrorResponse { code: string; message: string }`.

- [ ] **Step 1: Write failing tests** in `api/test/openapi.test.ts`:
  - `shouldBeValidOpenApiDocument_whenContractIsParsed` — `await SwaggerParser.validate('openapi.yaml')` resolves.
  - `shouldAcceptStatusBody_whenItMatchesContract` — `{ state: 'running', version: '0.1.0' }` → `valid === true`.
  - `shouldRejectStatusBody_whenVersionMissing` — `{ state: 'running' }` → `valid === false`.
  - `shouldAcceptErrorBody_whenStatusIs401` — `{ code: 'unauthorized', message: 'x' }` → `valid === true`.
- [ ] **Step 2:** Run `npm test -- --project api`. Expected: FAIL (no contract).
- [ ] **Step 3:** Write `openapi.yaml`; implement `validateResponse` (dereference with swagger-parser, compile the response schema with `Ajv2020`); add `generate` script `openapi-typescript openapi.yaml -o src/generated/schema.d.ts` and `build` = `generate`; export types from `src/index.ts`; `exports` map: `"."` and `"./contract-testing"`.
- [ ] **Step 4:** Run `npm run build -w @tagspot/api && npm test -- --project api`. Expected: 4 passed; `api/src/generated/schema.d.ts` exists.
- [ ] **Step 5:** Stage, propose `feat(api): add status contract and contract-test helpers`, wait.

---

### Task 3: Backend app — auth and status

`tasks.md`: 3.1, 3.2

**Files:**
- Create: `server/src/app.ts`, `server/src/auth/bearerAuth.ts`, `server/src/routes/status.ts`
- Test: `server/test/bearerAuth.test.ts`, `server/test/status.test.ts`

**Interfaces:**
- Consumes: `StatusResponse`, `ErrorResponse`, `validateResponse` (Task 2).
- Produces: `buildApp(options: { sessionSecret: string; version: string }): FastifyInstance` (not listening; tests use `app.inject`). `UNAUTHORIZED_ERROR: ErrorResponse = { code: 'unauthorized', message: 'Missing or invalid session secret' }`.

- [ ] **Step 1: Write failing tests** (use `app.inject`):
  - `shouldReturnStatus_whenSecretValid` — 200, body `{ state: 'running', version: '1.2.3' }`.
  - `shouldRejectRequest_whenSecretMissing` — 401, body equals `UNAUTHORIZED_ERROR`.
  - `shouldRejectRequest_whenSecretWrong` — 401.
  - `shouldRejectRequest_whenSchemeIsNotBearer` (`Basic <secret>`) — 401. *(Review Focus 1)*
  - `shouldRejectRequest_whenTokenEmpty` (`Bearer `) — 401. *(Review Focus 1)*
  - `shouldRejectRequest_whenSecretLengthDiffers` — 401, not 500. *(Review Focus 1)*
  - `shouldMatchContract_whenStatusReturns200` and `shouldMatchContract_whenStatusReturns401` — `validateResponse(...).valid === true`.
- [ ] **Step 2:** Run `npm test -- --project server`. Expected: FAIL.
- [ ] **Step 3:** Implement `registerBearerAuth(app, sessionSecret)` as an `onRequest` hook comparing with `crypto.timingSafeEqual` after a length check; `registerStatusRoute(app, version)`; `buildApp` wires both. No logging of headers.
- [ ] **Step 4:** Run `npm test -- --project server`. Expected: 8 passed.
- [ ] **Step 5:** Stage, propose `feat(server): add status endpoint behind session-secret auth`, wait.

---

### Task 4: Backend entry — handshake, loopback, parent watch

`tasks.md`: 3.3, 3.4

**Files:**
- Create: `server/src/protocol.ts`, `server/src/channel/parentChannel.ts`, `server/src/watchParent.ts`, `server/src/startBackend.ts`, `server/src/main.ts`
- Test: `server/test/watchParent.test.ts`, `server/test/main.integration.test.ts`

**Interfaces:**
- Produces (`@tagspot/server/protocol`, types only, used by `ui`):
  ```ts
  type ParentToBackend = { type: 'init'; sessionSecret: string; version: string };
  type BackendToParent = { type: 'ready'; port: number } | { type: 'error'; message: string };
  ```
- Produces: `interface ParentChannel { onMessage(h: (m: ParentToBackend) => void): void; postMessage(m: BackendToParent): void; onClose(h: () => void): void }`; `createParentChannel(): ParentChannel` (uses `process.parentPort` when present — Electron `utilityProcess` — else Node IPC `process.on('message')` / `process.send` / `'disconnect'`).
- Produces: `watchParent(isParentAlive: () => boolean, onGone: () => void, intervalMs: number): () => void` (returns stop).
- Produces: `startBackend(channel: ParentChannel): Promise<void>` — waits for `init` (`INIT_TIMEOUT_MS = 5_000`), validates it, `buildApp`, listens on `127.0.0.1:0`, posts `ready`; exits `0` on channel close or parent gone, exits `1` on invalid/missing `init` or listen failure (after posting `error` without the secret).
- `server/package.json` `exports`: `"./protocol"` → `src/protocol.ts` (types), `"./entry"` → `dist/main.js`; `build` = `tsc -p tsconfig.build.json`.

- [ ] **Step 1: Write failing tests.**
  - `watchParent.test.ts` (fake timers): `shouldCallOnGone_whenParentStopsBeingAlive`; `shouldNotCallOnGone_whenParentAlive`.
  - `main.integration.test.ts` forks `node src/main.ts` with Node IPC (`child_process.fork`, `execArgv: []`, Node 24 runs `.ts`):
    - `shouldReportReadyOnLoopbackPort_whenInitReceived` — `ready.port > 0`; `GET http://127.0.0.1:<port>/status` with the secret → 200.
    - `shouldPickDifferentPorts_whenTwoBackendsStart` — two forks, ports differ.
    - `shouldNotAcceptConnections_onNonLoopbackAddress` — connecting to the machine's first non-internal IPv4 address (from `os.networkInterfaces()`) on that port fails with `ECONNREFUSED`. *(Use a fixed test helper that returns the address; skip-with-reason in the helper if the machine has none, not an `if` in the test.)*
    - `shouldExit_whenParentChannelCloses` — `child.disconnect()` → exit code `0`.
    - `shouldExitWithError_whenInitHasNoSecret` — `{ type: 'init', version: 'x' }` → `error` message posted, exit `1`, never `ready`. *(Review Focus 5)*
    - `shouldExitWithError_whenNoInitArrives` (fake-free: real 5 s wait, test timeout 10 s) — exit `1`. *(Review Focus 5)*
    - `shouldNotIncludeSecret_inErrorMessage` — error text does not contain the secret used.
- [ ] **Step 2:** Run `npm test -- --project server`. Expected: FAIL.
- [ ] **Step 3:** Implement the files above. `main.ts` is three lines: create channel, `startBackend(channel)`, and a top-level catch that exits `1`.
- [ ] **Step 4:** Run `npm test -- --project server` and `npm run build -w @tagspot/server`. Expected: all pass; `server/dist/main.js` exists; `grep -r "electron" server/src` finds nothing.
- [ ] **Step 5:** Stage, propose `feat(server): add parent handshake and loopback-only listener`, wait.

---

### Task 5: Backend supervisor state machine

`tasks.md`: 4.1

**Files:**
- Create: `ui/src/main/backend/ProcessLauncher.ts`, `ui/src/main/backend/BackendSupervisor.ts`, `ui/src/main/backend/backendState.ts`
- Test: `ui/src/main/backend/BackendSupervisor.test.ts`, `ui/test/fakes/FakeLauncher.ts`

**Interfaces:**
- Consumes: `ParentToBackend`, `BackendToParent` (Task 4).
- Produces:
  ```ts
  interface BackendProcess { postMessage(m: ParentToBackend): void; onMessage(h: (m: BackendToParent) => void): void; onExit(h: (code: number | null) => void): void; kill(): void }
  interface ProcessLauncher { launch(): BackendProcess }
  type BackendState =
    | { status: 'starting' }
    | { status: 'running'; port: number; version: string }
    | { status: 'stopped'; reason: 'crashed' | 'quit' }
    | { status: 'failed'; reason: 'timeout' | 'error'; message: string };
  class BackendSupervisor {
    constructor(launcher: ProcessLauncher, options: { version: string; startupTimeoutMs: number; createSecret: () => string });
    start(): void; restart(): void; stop(): Promise<void>;
    getState(): BackendState; getConnection(): { port: number; sessionSecret: string } | null;
    onStateChange(listener: (s: BackendState) => void): () => void; // Observer
  }
  ```
  `STARTUP_TIMEOUT_MS = 15_000` exported from `backendState.ts`.

- [ ] **Step 1: Write failing tests** (fake timers + `FakeLauncher` that records launched fakes and lets tests emit messages/exits):
  - `shouldSendInitWithSecretAndVersion_whenStarted`
  - `shouldBeStarting_whenStartedAndNotReady`
  - `shouldBeRunning_whenReadyReceived` — state `{ status: 'running', port: 5123, version }`.
  - `shouldFailWithTimeout_whenNotReadyInTime` — and the process was killed.
  - `shouldIgnoreReady_whenItArrivesAfterTimeout` — state stays `failed`, late process killed. *(Review Focus 2)*
  - `shouldFailWithError_whenBackendReportsError`
  - `shouldBeStoppedCrashed_whenProcessExitsUnexpectedly`
  - `shouldStartNewProcess_whenRestartedAfterCrash`
  - `shouldKeepOneProcess_whenRestartCalledTwiceQuickly` — exactly one non-killed fake. *(Review Focus 3)*
  - `shouldKeepOneProcess_whenRestartCalledWhileStarting` *(Review Focus 3)*
  - `shouldBeStoppedQuit_whenStopCalled` — `stop()` resolves after exit; state reason `quit`, not `crashed`.
  - `shouldNotifyListeners_whenStateChanges` and `shouldStopNotifying_whenUnsubscribed`.
  - `shouldReturnNullConnection_whenNotRunning`
- [ ] **Step 2:** Run `npm test -- --project ui`. Expected: FAIL.
- [ ] **Step 3:** Implement. Track the current process by identity; ignore messages/exits from any process that is not current (this is what makes Review Focus 2 and 3 hold).
- [ ] **Step 4:** Run `npm test -- --project ui`. Expected: all pass.
- [ ] **Step 5:** Stage, propose `feat(ui): add backend supervisor state machine`, wait.

---

### Task 6: Electron launcher, secret, quit handling and main wiring

`tasks.md`: 4.2, 4.3, part of 5.1

*Extra deps:* `@vitejs/plugin-react`, `react-dom`, `@types/react`, `@types/react-dom` (with `electron`, `electron-vite`, `react` from `design.md`).

**Files:**
- Create: `ui/electron.vite.config.ts`, `ui/src/main/index.ts`, `ui/src/main/backend/UtilityProcessLauncher.ts`, `ui/src/main/backend/sessionSecret.ts`, `ui/src/main/backend/resolveBackendEntry.ts`, `ui/src/main/quitHandler.ts`, `ui/src/main/ipc.ts`
- Test: `ui/src/main/backend/sessionSecret.test.ts`, `ui/src/main/backend/UtilityProcessLauncher.test.ts`, `ui/src/main/quitHandler.test.ts`

**Interfaces:**
- Consumes: `BackendSupervisor`, `ProcessLauncher` (Task 5).
- Produces: `createSessionSecret(): string` (32 bytes, base64url); `class UtilityProcessLauncher implements ProcessLauncher` (constructor takes `{ entryPath: string; fork: typeof utilityProcess.fork }` so tests inject a fake `fork`); `resolveBackendEntry(): string` (`createRequire(import.meta.url).resolve('@tagspot/server/entry')`); `registerQuitHandler(app: QuitApp, supervisor: Pick<BackendSupervisor, 'stop' | 'getState'>): void` where `QuitApp = { on(e: 'before-quit', h: (ev: { preventDefault(): void }) => void): void; quit(): void }`.
- IPC channels (constants in `ipc.ts`): `backend:get-state`, `backend:state-changed`, `backend:restart`. The renderer-facing state is `RendererBackendState = BackendState & { connection: { baseUrl: string; sessionSecret: string } | null }`.

- [ ] **Step 1: Write failing tests:**
  - `shouldReturn43CharBase64UrlSecret_whenCreated` (32 bytes → 43 chars, `/^[A-Za-z0-9_-]{43}$/`); `shouldReturnDifferentSecrets_whenCalledTwice`.
  - `shouldForkWithoutSecretInArgsOrEnv_whenLaunched` — fake `fork` records `(path, args, options)`; after `postMessage(init)`, neither `args` nor `options.env` contains the secret.
  - `shouldStopBackendBeforeQuitting_whenAppQuits` — first `before-quit` calls `preventDefault`, awaits `stop`, then `quit()`; second `before-quit` (state `stopped`) does not prevent.
  - `shouldStopBackend_whenQuitWhileStarting` *(Review Focus 4)*
- [ ] **Step 2:** Run `npm test -- --project ui`. Expected: FAIL.
- [ ] **Step 3:** Implement. `main/index.ts`: single window with `contextIsolation`, `sandbox`, no `nodeIntegration`; create the supervisor with `app.getVersion()` and `STARTUP_TIMEOUT_MS`; wire IPC handlers and forward `onStateChange` to the window; `registerQuitHandler(app, supervisor)`; `supervisor.start()`.
- [ ] **Step 4:** Run `npm test -- --project ui`, then `npm run build` and `npm run dev`. Expected: tests pass; window opens (blank renderer is fine until Task 7).
- [ ] **Step 5:** Stage, propose `feat(ui): launch backend via utilityProcess and stop it on quit`, wait.

---

### Task 7: Preload bridge, API client and status UI

`tasks.md`: 5.1 (rest), 5.2, 5.3

*Extra deps:* `@testing-library/react`, `jsdom` (dev).

**Files:**
- Create: `ui/src/preload/index.ts`, `ui/src/renderer/index.html`, `ui/src/renderer/main.tsx`, `ui/src/renderer/App.tsx`, `ui/src/renderer/api/hubClient.ts`, `ui/src/renderer/status/deriveUiStatus.ts`, `ui/src/renderer/status/useBackendStatus.ts`, `ui/src/renderer/status/BackendStatus.tsx`, `ui/src/renderer/hubBridge.d.ts`
- Test: `ui/src/renderer/api/hubClient.test.ts`, `ui/src/renderer/status/deriveUiStatus.test.ts`, `ui/src/renderer/status/BackendStatus.test.tsx`

**Interfaces:**
- Consumes: IPC channels and `RendererBackendState` (Task 6); `paths` (Task 2).
- Produces: `window.hub: { getBackendState(): Promise<RendererBackendState>; onBackendStateChange(cb: (s: RendererBackendState) => void): () => void; restartBackend(): Promise<void> }` via `contextBridge`.
- Produces: `createHubClient(connection: { baseUrl: string; sessionSecret: string }, fetchImpl?: typeof fetch)` → `openapi-fetch` client typed with `paths`, header `Authorization: Bearer <secret>`.
- Produces: `type UiStatus = { kind: 'starting' } | { kind: 'running'; version: string } | { kind: 'stopped' } | { kind: 'failed'; message: string }`; `deriveUiStatus(backend: RendererBackendState, lastStatusCheck: 'ok' | 'failed' | 'none'): UiStatus`.
- Produces: `<BackendStatus status={UiStatus} onRetry={() => void} onRestart={() => void} />`. Visible text: `Starting backend…`, `Backend running · v<version>`, `Backend stopped` + button `Restart`, `Backend failed to start: <message>` + button `Retry`.

- [ ] **Step 1: Write failing tests:**
  - `shouldSendBearerSecret_whenRequestingStatus` — fake `fetch` captures the `Authorization` header.
  - `deriveUiStatus`: `shouldBeRunning_whenSupervisorRunningAndCheckOk`; `shouldBeStopped_whenSupervisorRunningButCheckFailed`; `shouldBeStopped_whenSupervisorCrashed`; `shouldBeFailed_whenSupervisorFailed`; `shouldBeStarting_whenSupervisorStarting`.
  - `BackendStatus` (`// @vitest-environment jsdom`): one test per state asserting the exact text; `shouldCallOnRestart_whenRestartClicked`; `shouldCallOnRetry_whenRetryClicked`.
- [ ] **Step 2:** Run `npm test -- --project ui`. Expected: FAIL.
- [ ] **Step 3:** Implement. `index.html` CSP: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' http://127.0.0.1:*` (plus `ws://localhost:*` only in dev via electron-vite's dev HTML transform). `useBackendStatus` subscribes to `window.hub`, polls `GET /status` every `STATUS_POLL_INTERVAL_MS` while running, and returns `deriveUiStatus(...)`. Both `onRetry` and `onRestart` call `window.hub.restartBackend()`.
- [ ] **Step 4:** Run `npm test -- --project ui` and `npm run dev`. Expected: tests pass; window shows `Backend running · v0.1.0`; killing the backend process in Task Manager shows `Backend stopped`, and `Restart` brings it back.
- [ ] **Step 5:** Stage, propose `feat(ui): show backend status through generated api client`, wait.

---

### Task 8: ADR 12 and CLAUDE.md

`tasks.md`: 6.1, 6.2

**Files:**
- Create: `docs/adr/0012-node-backend-separate-process.md` (format copied from the docs repo's `AI-Hub/docs/adr/template.md`)
- Modify: `CLAUDE.md` (Project section)

- [ ] **Step 1:** Write ADR 12 (Status: Accepted; Date: implementation date). Context: gateway-centric hub, Agent/MCP SDKs strongest in TS. Decision: Node/TS backend in a `utilityProcess`, contract-first API, session secret. Consequences: supersedes ADR 3 for the hub; ADR 6 needs Node replacements for Tika/LangChain4j; ADR 7 → LangGraph.js; ADR 8 only for future local MCP servers; ADR 11 `server/` is a Node package.
- [ ] **Step 2:** Update `CLAUDE.md` Project section: Node/TS backend, no JRE for the hub, and commands `npm install`, `npm run dev`, `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`.
- [ ] **Step 3:** Run each documented command except `dev`. Expected: all exit 0.
- [ ] **Step 4:** Stage, propose `docs: record node backend decision in adr 12`, wait.

---

### Task 9: End-to-end smoke test and full verification

`tasks.md`: 7.1, 7.2

*Deps:* `@playwright/test` (dev, in `ui`).

**Files:**
- Create: `ui/playwright.config.ts`, `ui/e2e/app.spec.ts`

- [ ] **Step 1: Write the test** `shouldShowRunningAndLeaveNoBackend_whenAppStartsAndQuits`:
  - Given: `npm run build` output; `_electron.launch({ args: ['out/main/index.js'] })`.
  - When: the window shows `Backend running · v` (wait up to `STARTUP_TIMEOUT_MS`), read `port` via `window.hub.getBackendState()`; then `electronApp.close()`.
  - Then: `fetch('http://127.0.0.1:<port>/status')` rejects (connection refused).
- [ ] **Step 2:** Run `npm run build && npm run test:e2e`. Expected: 1 passed.
- [ ] **Step 3:** Run `npm run lint && npm run build && npm test && npm run test:e2e` from the root. Expected: all exit 0, no warnings.
- [ ] **Step 4:** Run `openspec validate setup-project-structure --strict`. Expected: valid; every box in `tasks.md` ticked.
- [ ] **Step 5:** Stage, propose `test(ui): add electron smoke test for backend lifecycle`, wait.
