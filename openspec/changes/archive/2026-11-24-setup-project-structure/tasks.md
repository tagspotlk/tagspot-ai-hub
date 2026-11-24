# Tasks

## 1. Workspace and tooling

- [x] 1.1 Create root `package.json` with npm workspaces `api`, `server`, `ui` and root scripts `build`, `test`, `lint`, `dev`; verify `npm install` succeeds from the root
- [x] 1.2 Add shared strict TypeScript base config, ESLint and Prettier at the root; verify `npm run lint` passes on the empty workspaces
- [x] 1.3 Add Vitest at the root with per-workspace projects; verify `npm test` runs and reports zero failures
- [x] 1.4 Add `.gitignore` (node_modules, build output, generated types) and `packaging/README.md` stating the installer is a later change; verify `git status` shows no build artifacts after a build

## 2. API contract

- [x] 2.1 Write `api/openapi.yaml` with `GET /status` (state, version), bearer-token security, and a shared error schema for 401; verify it passes OpenAPI lint/validation
- [x] 2.2 Generate TypeScript types from the contract with `openapi-typescript` as an `api` build step; verify `npm run build -w api` produces the types and `server`/`ui` can import them

## 3. Backend (server)

- [x] 3.1 Create the Fastify app with a bearer-token hook that rejects requests without the session secret; verify with tests for "valid secret" and "missing secret → 401"
- [x] 3.2 Implement `GET /status` returning state and version; verify with a test, and a contract test that validates the 200 and 401 bodies against `openapi.yaml`
- [x] 3.3 Implement the backend entry: receive the secret from the parent channel, listen on `127.0.0.1` port 0, send `{ ready, port }`, exit when the parent channel closes; verify with tests for loopback binding, free-port selection and exit on parent close
- [x] 3.4 Ensure the backend entry has no Electron imports; verify the backend starts under plain Node with a test harness

## 4. Backend supervision (ui main process)

- [x] 4.1 Define the `ProcessLauncher` interface and `BackendSupervisor` state machine (starting, running, stopped, failed) with a 15 s startup timeout constant; verify unit tests with a fake launcher for ready, timeout, crash and restart
- [x] 4.2 Implement the `utilityProcess` launcher adapter and secret generation; verify the secret is passed only over the parent channel (test that it is absent from the fork arguments)
- [x] 4.3 Stop the backend on app quit; verify with a unit test that quit stops the backend before exit

## 5. UI (renderer)

- [x] 5.1 Scaffold the electron-vite app (main, preload, React renderer) with `contextIsolation` on, `nodeIntegration` off and a strict CSP; verify `npm run dev` opens the window
- [x] 5.2 Proxy API calls through main: preload exposes `apiRequest` over IPC, main adds the bearer secret and calls the backend; the renderer's `openapi-fetch` client uses an IPC-backed `fetch` and never sees the port or secret; verify unit tests that main adds the bearer token, rejects non-relative paths, and that the renderer client goes through `apiRequest`
- [x] 5.3 Show backend status (starting, running with version, stopped, startup error with retry, restart after crash); verify component tests for each state

## 6. Architecture record

- [x] 6.1 Add `docs/adr/0012-node-backend-separate-process.md` recording the Node/TS backend in a separate process and which parts of ADRs 3, 6, 7, 8 and 11 it supersedes; verify it follows the docs repo's ADR template
- [x] 6.2 Update `CLAUDE.md` project section (Node/TS backend, no JRE for the hub, commands to install/build/test/run); verify the documented commands run as written

## 7. Integration

- [x] 7.1 Add a Playwright Electron smoke test: launch the app, see "running" with the version, quit, and confirm no backend process remains; verify it passes locally
- [x] 7.2 Run `npm run lint`, `npm run build` and `npm test` from the root; verify all pass with no warnings treated as errors

## Workflow follow-up

- In the docs repo, mark ADRs 3, 6, 7, 8 and 11 as superseded or updated by ADR 12 (or do it as part of `move-hub-adrs`).
- Sync specs with `openspec-sync-specs`, then archive with `openspec-archive-change`.
