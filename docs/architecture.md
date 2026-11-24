# Architecture

This document grows with the hub. Each OpenSpec change that alters the architecture
updates the diagrams below and adds a row to the [change log](#change-log).
Decisions behind it live in [`docs/adr/`](adr/); behavior lives in
[`openspec/specs/`](../openspec/specs/).

## Components

```mermaid
flowchart LR
  user([User])

  subgraph App["Tagspot AI Hub (Electron app)"]
    subgraph Main["Main process (Node)"]
      sup["Backend supervisor"]
      proxy["API proxy<br/>adds session secret"]
    end
    subgraph Renderer["Renderer process (Chromium, sandboxed)"]
      preload["Preload<br/>window.hub"]
      react["React UI"]
    end
  end

  subgraph Backend["Backend process (Node, utilityProcess)"]
    api["Fastify REST API<br/>127.0.0.1:random port"]
  end

  contract[["api/openapi.yaml<br/>(contract + generated types)"]]

  user --> react
  react --> preload
  preload -- IPC --> proxy
  proxy -- "HTTP + Bearer secret" --> api
  sup -- "starts, watches, stops" --> Backend
  contract -.-> react
  contract -.-> api
```

**Rules**

- The renderer never sees the backend's port or session secret. Every API call
  goes renderer → preload → IPC → main → backend.
- The backend listens on `127.0.0.1` only and rejects any request without the
  session secret.
- Main accepts IPC only from the app's own page; the window cannot navigate away
  or open new windows.
- The UI and backend share one contract: `api/openapi.yaml`.

## Startup

```mermaid
sequenceDiagram
  autonumber
  participant E as Electron
  participant M as Main process
  participant B as Backend process
  participant R as Renderer (React)

  E->>M: start app (ui/src/main/index.ts)
  M->>M: generate session secret (32 random bytes, memory only)
  M->>B: start via utilityProcess (server/dist/main.js)
  M->>B: message: init { sessionSecret }
  B->>B: listen on 127.0.0.1, OS picks a free port
  B-->>M: message: ready { port }
  M->>R: open window, load preload then React
  R->>M: IPC get state
  M-->>R: { status: running }
  Note over M,B: Startup timeout 15 s. If the backend exits or fails,<br/>the UI shows "stopped" or "failed" with Restart / Retry.
```

## Request flow (renderer → backend)

```mermaid
sequenceDiagram
  participant R as React UI
  participant P as Preload (window.hub)
  participant M as Main (API proxy)
  participant B as Backend (Fastify)

  R->>P: client.GET("/status")  (generated openapi-fetch client)
  P->>M: IPC backend:api-request { method, path, body }
  M->>M: check sender is the app page, path is relative
  M->>B: GET http://127.0.0.1:port/status + Authorization: Bearer secret
  B->>B: check secret (constant-time)
  B-->>M: 200 { state: running, version }
  M-->>P: { status, body, contentType }
  P-->>R: Response → typed data
  Note over M,B: Each request times out after 3 s.<br/>The UI polls status every 5 s while running.
```

## Shutdown

- **User quits:** main stops the backend first (waits at most 5 s), then exits.
- **Backend crashes:** the UI shows "Backend stopped" with a Restart button.
- **App is killed:** the backend checks every 2 s that its parent is alive and
  exits on its own.

## Change log

| Change                    | Date       | Architecture impact                                                                                                                                                                                      |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup-project-structure` | 2026-11-24 | First version: Electron main, sandboxed React renderer, Node/Fastify backend in a `utilityProcess`, session secret, API calls proxied through main ([ADR 12](adr/0012-node-backend-separate-process.md)) |
