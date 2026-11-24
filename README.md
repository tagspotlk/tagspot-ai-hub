# Tagspot AI Hub

A local-first desktop app for the Tagspot team: one place for chats, agents,
MCP tools and workflows. Electron + React UI with a local Node backend.

## Prerequisites

- Node.js 24 (see `.nvmrc`) and npm
- Windows

## Build and run

```bash
npm run setup   # first time: install everything
npm run dev     # run the app with hot reload
```

| Command         | What it does                                                              |
| --------------- | ------------------------------------------------------------------------- |
| `npm run setup` | Install dependencies and the Electron binary                              |
| `npm run dev`   | Start the app in development mode                                         |
| `npm start`     | Build and run the production build                                        |
| `npm run check` | Lint, type-check, unit tests and end-to-end tests (run before committing) |

## Repo layout

| Path        | Holds                                                      |
| ----------- | ---------------------------------------------------------- |
| `ui/`       | Electron app: main process, preload, React UI              |
| `server/`   | Node/TypeScript backend (Fastify)                          |
| `api/`      | `openapi.yaml`, the contract between UI and backend        |
| `docs/`     | [Architecture](docs/architecture.md) and [ADRs](docs/adr/) |
| `openspec/` | Capability specs and change history                        |
