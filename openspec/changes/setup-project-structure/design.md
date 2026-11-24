# Design

## Context

The repo contains only `CLAUDE.md` and `openspec/`. Explore decided a Node/TS hub
backend in a separate process (see `proposal.md` → Why). Constraints that shape
the approach:

- Windows first; Node 24 and npm 11 are installed, pnpm is not.
- The backend will later host the MCP gateway and must keep running while the
  window is closed (tray app), so its lifetime follows the app's main process,
  not the window.
- The UI talks to the backend only through the OpenAPI contract (ADR 9).
- Later features (gateway, PATs) make the local API security-sensitive, so the
  API is protected from the first commit.

Requirements are in `specs/backend-lifecycle/spec.md` and
`specs/system-status/spec.md`.

## Goals / Non-Goals

**Goals:**
- One command each to install, build, test, lint and run the whole repo.
- Contract-first API: `api/openapi.yaml` is the source of truth for both sides.
- A backend-supervision design the gateway feature can build on unchanged.

**Non-Goals:**
- Visual design of the app; the status indicator is deliberately plain until
  the design stage of the first UI feature.
- Installer and code signing (`packaging/` holds only a README).
- Auto-restart policy; restart is manual in this change.

## Decisions

### 1. npm workspaces for the monorepo
Root `package.json` declares workspaces `ui`, `server`, `api`.
*Why:* npm is already installed and is enough for three packages.
*Alternatives:* pnpm (faster, stricter dependency isolation, but another tool to
install); Nx or Turborepo (not worth it at this size).

### 2. Backend started with Electron `utilityProcess`
The main process forks `server/` with `utilityProcess.fork`.
*Why:* it runs on the Node built into Electron, so there is no separate Node
runtime to ship, and it gives a message channel to the parent for the startup
handshake. It is a real OS process, so a backend crash does not take the UI down.
*Alternatives:* `child_process.spawn` of a system Node (needs Node installed or
shipped separately); running the backend in the main process (rejected in explore).

### 3. Startup handshake over the parent channel
1. Main generates a random session secret (32 bytes) and passes it to the backend
   through the parent message channel, never on the command line (command lines
   are visible to other processes).
2. The backend listens on `127.0.0.1`, port `0` (the OS picks a free port).
3. When listening, the backend sends `{ ready, port }` to main.
4. Main keeps `port` and the secret. The renderer never sees either: its
   `openapi-fetch` client uses a custom `fetch` that sends each request over IPC
   (preload `window.hub.apiRequest` → `ipcMain` handler). Main validates the
   request (relative path only, trusted sender frame only), adds
   `Authorization: Bearer <secret>`, calls the backend from Node and returns
   `{ status, body, contentType }`. The window cannot navigate or open new
   windows, so only the app's own page can reach the proxy.
5. The backend reports its own version (from `server/package.json`) in
   `GET /status`; `init` carries only the secret.

*Why main proxies API calls:* the renderer is a browser page, so a direct call to
`127.0.0.1:<port>` with an `Authorization` header triggers a CORS preflight that
the backend's auth hook rejects. Proxying through main avoids CORS entirely and
keeps the secret out of the renderer. *Alternative rejected:* CORS on the backend
with an origin allow-list (production origin is `null` for `file://`, needs a
custom protocol, and the renderer would still hold the secret). *Cost:* streaming
responses (future chat) need an IPC streaming channel.

The backend also exits when its parent goes away, which covers the "app is
killed" scenario: on Node IPC it reacts to the channel's `disconnect`; under
Electron's `utilityProcess` (no close event) it polls whether the parent process
is still alive every 2 seconds.
*Alternatives:* a fixed port (collisions; rejected by spec); writing the port to a
file (stale files after crashes).

### 4. Fastify for the HTTP server
*Why:* first-class TypeScript, a hook to check the bearer token on every route in
one place, and fast startup.
*Alternatives:* Express (older typings, no built-in schema hooks); Hono (small and
fine, but a smaller Node-server ecosystem for the gateway work ahead).

### 5. Contract-first with `openapi-typescript` + `openapi-fetch`
`api/` holds `openapi.yaml` and generates TypeScript types. The UI uses
`openapi-fetch` with those types; the server uses the same types for its handlers.
Contract tests validate real responses against the schema.
*Why:* types only, no runtime code generator, no Java needed.
*Alternatives:* `openapi-generator` (needs Java, generates a lot of code); `orval`
(heavier; useful later if we want generated React hooks).

### 6. electron-vite + React for the UI
*Why:* electron-vite builds main, preload and renderer with one config and fast
reload; React has the largest ecosystem for the chat and workflow UIs to come.
*Alternatives:* Electron Forge with webpack (slower builds, but Forge's packaging
can still be added later); Vue or Svelte (fine, but less common in the team's
likely hires and libraries).

### 7. Supervisor behind a process-launcher interface
`BackendSupervisor` owns the state machine (starting → running → stopped/failed)
and depends on a `ProcessLauncher` interface. The Electron implementation adapts
`utilityProcess` (Adapter pattern); tests use a fake launcher, so every lifecycle
scenario can be unit-tested without Electron.

```
 starting --ready--> running --exit--> stopped --restart--> starting
    |                                     ^
    +--timeout--> failed --retry----------+--> starting
```

Startup timeout: 15 seconds, as a named constant.

### 8. Tooling
TypeScript strict mode everywhere; Vitest for unit and contract tests; Playwright's
Electron support for one end-to-end smoke test (app starts, status shows running);
ESLint and Prettier at the root.

### 9. Layout

```
tagspot-ai-hub/
+-- package.json          workspaces + root scripts (build, test, lint, dev)
+-- api/                  openapi.yaml + generated types (package)
+-- server/               Fastify backend, entry for utilityProcess
+-- ui/                   electron-vite app: main/, preload/, renderer/
+-- packaging/            README only (installer is a later change)
+-- docs/adr/             0012-node-backend-separate-process.md
+-- openspec/
```

## Risks / Trade-offs

- [Electron's built-in Node differs from the Node 24 used for tests] → keep the
  backend on standard Node APIs; the Electron smoke test runs the real path.
- [A compromised renderer could still make API calls through the IPC proxy] →
  the secret itself never reaches the renderer; `contextIsolation` on,
  `nodeIntegration` off, `sandbox` on, a strict CSP, and main forwards only
  relative paths to the backend.
- [`utilityProcess` ties the backend to Electron] → the backend entry has no
  Electron imports; only the launcher adapter knows about Electron, so the backend
  can later run under plain Node if needed.
- [New dependencies (Electron, React, Fastify, openapi-typescript, openapi-fetch,
  electron-vite, Vitest, Playwright, ESLint, Prettier)] → listed here for approval
  before the plan is written; exact versions are pinned in the lockfile.

## Migration Plan

New repo, nothing to migrate. ADR 12 is added in this repo's `docs/adr/`; ADRs
1–11 move here in the separate `move-hub-adrs` change, and ADR 12 records which
of them it supersedes.
