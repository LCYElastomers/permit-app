# Architecture

Permit Control is an offline-first permit-to-work application. This document describes the foundation that exists now and the boundary the Tauri client must keep.

## What exists today

The Tauri application still keeps permit lists, detail, and dashboard metrics in `src/data/mock.ts`. It does not read PostgreSQL. Startup does not wait for the API. After the first paint, the shell checks API health in the background, and New Permit loads areas when that screen opens.

The ASP.NET Core solution under `server/` compiles without a database. `GET /api/v1/health` does not open a connection and does not return configuration values. `GET /api/v1/health/ready` checks connectivity only. `GET` and `POST /api/v1/areas` read and create areas when PostgreSQL is configured. Other data endpoints return `503 database-not-configured` until `PERMIT_DB_*` is fully set, and `501` after that until the handlers are written. Sync push and pull return `501 sync-not-implemented`.

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

The UI base URL is `VITE_PERMIT_API_URL`. When it is unset, the desktop app uses `https://permit-control.local`. A developer can point at a local API by setting that variable. The value is not written into React screens.

## Connectivity

Startup renders immediately. A background check then calls `GET /api/v1/health` and, only if that process responds, `GET /api/v1/health/ready`. Each request times out after 5 seconds. The check repeats every 30 seconds and does not overlap itself.

The shell shows `CHECKING` until the first result, `ONLINE` when the process and database are ready, `OFFLINE` when the process cannot be reached, and `SERVER NOT READY` when the process is up but readiness fails. The panel does not show the API host, status codes, or database errors. Navigation and mock permit screens do not wait on these calls.

New Permit loads areas from `GET /api/v1/areas` through the area service. The selector shows `name` and stores the area UUID on the draft. If the request fails, the rest of the form stays usable and no mock area list is substituted. Permit lists, detail, and dashboard metrics still use `src/data/mock.ts`.

## Not built yet

- Live PostgreSQL deployment
- Authentication (local passwords or Entra)
- SQLite on the client
- The sync engine
- File upload routes
- Replacing mock permit data
