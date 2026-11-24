# Proposal

## Why

The hub repo is empty, and the explore phase changed the core architecture: the hub
backend is now Node/TypeScript running as a separate local process, not Spring Boot,
and MCP servers move to their own project. Every later feature (gateway, chat,
agents, workflows) needs a working skeleton that builds, starts, and proves the
UI ↔ backend path end to end.

## What Changes

- Set up the monorepo layout from ADR 11 for a Node/TS stack: `ui/` (Electron),
  `server/` (Node/TS backend), `api/openapi.yaml` (contract), `packaging/`.
- Add a single workspace toolchain: one install, build, test and lint command for
  the whole repo.
- The Electron app starts the backend as a **separate process**, waits until it is
  ready, and stops it when the app quits.
- The backend serves a minimal REST API on localhost, described in
  `api/openapi.yaml`, with a status endpoint.
- The UI calls the backend only through a client generated from the OpenAPI
  contract and shows whether the backend is running.
- Add a new ADR in `docs/adr/` that records the Node/TS backend in a separate
  process and supersedes the Spring Boot hub server (ADR 3) for the hub.
- **BREAKING** (architecture, not code): the hub no longer needs a bundled JRE
  (ADR 8 applies only to future local MCP servers). ADRs 6, 7 and 11 need follow-up
  updates for Node equivalents.

Out of scope: MCP gateway, named-pipe launcher, tray/start-at-login behavior,
Credential Manager, SQLite, installer, MCP servers (separate project), and moving
the existing ADRs into this repo (separate change `move-hub-adrs`).

## Capabilities

### New Capabilities

- `backend-lifecycle`: How the desktop app starts, monitors and stops the local
  backend process, and how startup failure is reported to the user.
- `system-status`: The backend's status endpoint in the OpenAPI contract and how
  the UI reads and shows backend status through the generated client.

### Modified Capabilities

None. No specs exist yet.

## Impact

- **Code:** new `ui/`, `server/`, `api/`, `packaging/` skeletons and root
  workspace configuration.
- **APIs:** first version of `api/openapi.yaml` (status endpoint only).
- **Dependencies (need approval before adding):** Electron, TypeScript, a Node
  HTTP framework, an OpenAPI client generator, a test runner and a linter. The
  exact choices are made in `design.md`.
- **Docs:** new ADR in `docs/adr/`. ADR 3, 6, 7, 8 and 11 (in the docs repo until
  `move-hub-adrs`) will be marked as superseded or updated.
- **CI:** Node only for the hub; Java is no longer needed in this repo.
