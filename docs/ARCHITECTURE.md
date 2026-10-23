# Architecture

Permit Control is an offline-first permit-to-work application. This document describes the foundation that exists now and the boundary the Tauri client must keep.

## What exists today

The Tauri application keeps permit lists, detail, and dashboard metrics in `src/data/mock.ts`. It does not read PostgreSQL. Startup does not wait for the API. After the first paint, the shell probes Plant Link in the background. New Permit reads areas from the local SQLite catalog. A live area request happens only after Plant Link is `READY`, and only to refresh that catalog.

The ASP.NET Core solution under `server/` compiles without a database. `GET /api/v1/health` does not open a connection and does not return configuration values. `GET /api/v1/health/ready` checks connectivity only. `GET` and `POST /api/v1/areas` read and create areas when PostgreSQL is configured. Other data endpoints return `503 database-not-configured` until `PERMIT_DB_*` is fully set, and `501` after that until the handlers are written. Sync push and pull return `501 sync-not-implemented`. Permit synchronization is not implemented.

## Intended runtime

```
Tauri (React)
  |
  | local SQLite in the Tauri app-data directory
  |
  | HTTPS / JSON, only after Plant Link is READY
  v
ASP.NET Core API  (PermitControl.Api)
  |
  +-- PostgreSQL          authoritative plant records
  |
  +-- server filesystem   attachment bytes (IFileStorage / LOCAL_SERVER)
```

The Tauri process must never open a PostgreSQL connection. The API is the only server-side interface. SQLite and PostgreSQL share identifiers and lifecycle meaning. They do not share a physical schema.

## Field tablet

Permit Control is used on Getac rugged tablets, including portrait, and on desktop leadership screens. Those are two layouts of the same application. Domain rules, local persistence, synchronization, and the six-step permit workflow stay shared. The portrait layout, touch targets, local-save wording, and safety presentation are specified in `docs/DESIGN.md`.

## Printable permits

Printable permits are controlled document representations generated from structured Permit Control data. The tablet/desktop UI is not the printable document. Generated PDFs must identify the permit UUID/number, revision, lifecycle status, generation timestamp, and applicable permit modules. Closed permits produce an immutable final PDF whose SHA-256 hash is recorded in PostgreSQL.

A synchronized General Work permit can be rendered on the server into a working PDF. The client sends the permit id. The API loads the PostgreSQL permit, its rows, and the `general-work-facts` creation payload. It does not accept a screen, a SQLite working state, or a client-supplied permit body. Each generation writes a new file under the storage key `exports/generated/{permit-id}/{export-id}.pdf`, records a `permit_exports` row, and stores the SHA-256 of the PDF bytes. The physical file is not overwritten. The client receives export metadata and a download name. It does not receive the storage root or the storage key.

`FINAL_ARCHIVE` is reserved and refused. When a General Work permit can be closed, closure will generate one final PDF, hash it, store it in the archive namespace, record that export, preserve attachments, and later write `manifest.json`. That final artifact is not replaced. Closure does not exist yet, so that archive path is not built.

Any authoritative General Work permit can be printed or exported. The PDF states the lifecycle status stored on the server. Only `ACTIVE` says `WORK AUTHORIZED`. Every other known status has an explicit non-authorizing or historical line, and an unrecognized status says `NOT AUTHORIZED FOR WORK`. A later page repeats the permit number, revision, status, and that line. Each generation records the status and revision on a new `permit_exports` row and does not replace an earlier file. Plant Link must be ready before the desktop app can ask for the PDF. A failed request leaves the local permit unchanged. There is no offline renderer. Station sample permits are not server records and do not call the export API.

## Local database

The desktop store is one SQLite file for one device, opened by the Rust side of the Tauri app through `rusqlite` with the bundled SQLite library. React calls application commands. It does not see SQL, the database path, PostgreSQL, or server file paths.

The file is `permit-control.sqlite`. Tauri resolves the directory from `app.path().app_data_dir()` using the bundle identifier `com.lcygroup.permitcontrol`. There is no `appDirectoriesOverride`. On Windows, Tauri 2 joins `{FOLDERID_RoamingAppData}` with that identifier, so the database is `%APPDATA%\com.lcygroup.permitcontrol\permit-control.sqlite`. The first successful open creates the directory and the file. Nothing is copied from the old `com.tauri.dev` development identifier. The database is not stored beside the executable, in the source tree, on the Desktop, in Downloads, or in a hard-coded user path.

Schema changes are versioned in `schema_migrations`. Migration 1 creates the local tables and is applied inside a transaction. Opening an existing database applies only migrations newer than the stored version. `CREATE TABLE IF NOT EXISTS` is not the migration strategy.

Local tables:

| Table | Role |
| --- | --- |
| `schema_migrations` | Applied migration versions. |
| `reference_areas` | Cached plant areas. The id is the server UUID. |
| `local_permits` | Device permits. Identity is a client UUID. General Work drafts are written here. The permit number stays null. |
| `local_permit_events` | Append-only local events. Not synchronized yet. |
| `outbox` | Durable work waiting for a future push. Pending count is `COUNT(*)` of rows that are not `ACKNOWLEDGED`. |
| `sync_state` | One row: plant contact, reference sync, permit sync, last attempt, coordinator state, and the area-catalog time. |

`sync_state.current_sync_state` is `IDLE`, `PENDING`, `SYNCING`, `BACKOFF`, or `REQUIRES_ATTENTION`. `PENDING` is stored when the outbox has unacknowledged rows. The count itself is always read from the outbox. `last_permit_sync_at` stays empty until permit push exists. An area refresh writes `last_reference_sync_at` only.

The first Save Draft for General Work is one SQLite transaction containing the permit, a `PERMIT_CREATED` event, and a `PENDING` outbox row. That commit is the save. The network is not part of it. A later save updates the draft row and does not add another event. See `docs/SYNC.md`.

If the file cannot be opened or a later read or write fails, the shell reports local data unavailable. That is not the same as Plant Link being offline. The UI does not show the SQL exception, does not invent a pending count, and does not treat memory as a substitute database.

## Connectivity

Internet connectivity is not Plant Link connectivity. A tablet can have cellular service and still be unable to reach `https://permit-control.local`. The shell never reads `navigator.onLine`, Wi-Fi state, or cellular state, and those signals do not start synchronization.

Startup renders immediately. A background probe then calls `GET /api/v1/health` and, only if that process responds, `GET /api/v1/health/ready`. Each request times out after 5 seconds. The next probe is scheduled 30 seconds after the previous one finishes, so probes do not overlap. The probe only reports Plant Link. It does not synchronize.

Plant Link is `CHECKING` before the first result, `UNREACHABLE` when the process cannot be reached, `API_ONLINE` when the process responds but readiness fails, and `READY` only when readiness succeeds. The panel shows those as CHECKING, OFFLINE, NOT READY, and CONNECTED. It also shows whether local data is available and, only when SQLite answered, the outbox pending count. It does not show the API host, status codes, or database errors.

## Area cache

New Permit reads `reference_areas`. It does not call the API to fill the selector.

When Plant Link changes from any other state to `READY`, the sync coordinator fetches `GET /api/v1/areas`. The full payload is validated first. Only then does SQLite delete and insert the catalog in one transaction, and set `reference_areas_synced_at`. If validation or the request fails, the previous rows and that timestamp stay as they were. An empty but valid payload is a real empty catalog. A failed refresh is not.

The server has no enabled or inactive area flag, and this client does not invent one. A future removal or deactivation has to arrive as an explicit server fact inside a fully validated catalog response. The client may then omit that area from `reference_areas` in the same transaction. It must not delete local permits that still store the area id, and it must not treat a failed, aborted, or partial response as removal.

With a cached catalog, New Permit stays usable while Plant Link is unreachable. On a first launch with no successful catalog refresh, the selector says reference data has not been synchronized and does not invent areas.

## Sync coordinator

`SyncCoordinator` runs when Plant Link becomes `READY`, when a General Work draft is saved while Plant Link is already `READY`, or when Sync Now is requested later. The Sync Now control is not in the UI yet. It refuses to start unless Plant Link is `READY`, and it runs one cycle at a time. The cycle refreshes the area catalog and then pushes pending General Work `PERMIT_CREATED` rows. It does not pull server events or upload files. Save Draft returns when SQLite commits. The push runs after that.

If Plant Link leaves `READY` during a cycle, the coordinator aborts that cycle and returns to the normal health probe. It does not acknowledge an unconfirmed row and it does not start a retry timer. A later `READY` transition may start another cycle.

A timeout, lost connection, or HTTP 502, 503, or 504 leaves the row pending and sets `BACKOFF`. HTTP 400 and 409 set that outbox row to `ATTENTION`. `last_permit_sync_at` changes only after a valid acknowledgement. An area refresh does not change it.

## Not built yet

- Live PostgreSQL deployment
- Authentication (local passwords or Entra)
- Server pull, and synchronization of any event other than General Work `PERMIT_CREATED`
- Attachment bytes and file upload
- Final closed-permit archive PDF, manifest, and attachment preservation
- Replacing mock permit data
- Equipment or contractor reference caches
- Command Center live permit metrics


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
