# Architecture

Permit Control is an offline-first permit-to-work application. This document describes the foundation that exists now and the boundary the Tauri client must keep.

## What exists today

The Tauri application is a React mock. It does not call the API during startup and does not read PostgreSQL. Screens still use `src/data/mock.ts`.

The ASP.NET Core solution under `server/` compiles without a database. `GET /api/v1/health` does not open a connection and does not return configuration values. Other data endpoints return `503 database-not-configured` until `PERMIT_DB_*` is fully set, and `501` after that until the handlers are written. Sync push and pull return `501 sync-not-implemented`.

## Intended runtime

```
Tauri (React)
  |
  | local persistence (future SQLite) and attachment cache
  |
  | HTTPS / JSON
  v
ASP.NET Core API  (PermitControl.Api)
  |
  +-- PostgreSQL          metadata, permits, events, readings
  |
  +-- server filesystem   attachment bytes (IFileStorage / LOCAL_SERVER)
```

The Tauri process must never open a PostgreSQL connection. The API is the only server-side interface.

## Projects

| Project | Responsibility |
| --- | --- |
| `PermitControl.Domain` | Entities, classifications, safety-transition rules, module advisor. No EF, no HTTP. |
| `PermitControl.Application` | Request and response contracts, `IFileStorage`, `IDatabaseAvailability`. |
| `PermitControl.Infrastructure` | EF Core model, Npgsql, local file-storage skeleton. |
| `PermitControl.Api` | HTTP, Swagger in Development, composition root. |
| `PermitControl.Domain.Tests` | Unit tests that do not need PostgreSQL. |

## Configuration

Database settings come from environment variables `PERMIT_DB_HOST`, `PERMIT_DB_PORT`, `PERMIT_DB_NAME`, `PERMIT_DB_USER`, and `PERMIT_DB_PASSWORD`, or from the `PermitDatabase` section. A connection string is treated as configured only when host, name, user, and password are all present. The password in `.env.example` is the placeholder `CHANGE_ME`.

`PERMIT_FILE_ROOT` is the future directory for attachment bytes. `LocalFileStorage` can write a file there, but no upload route calls it yet.

The UI base URL is `VITE_PERMIT_API_URL`, defaulting to `http://127.0.0.1:5080`. The client helpers live in `src/lib/api/` and are not used by the screens yet.

## Connectivity

`src/lib/connectivity.ts` defines `online`, `offline`, `syncing`, and `sync-error`. The shell still reads `mockConnectivity`, which reports online and last synced `13:27`. Startup does not call `/api/v1/health`.

## Not built yet

- Live PostgreSQL deployment
- Authentication (local passwords or Entra)
- SQLite on the client
- The sync engine
- File upload routes
- Replacing mock permit data
