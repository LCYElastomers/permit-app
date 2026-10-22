# Sync

Internet connectivity is not Plant Link connectivity. A field tablet may have cellular service and still be unable to reach the Permit Control API at `https://permit-control.local`. General internet, `navigator.onLine`, Wi-Fi, and cellular state are not permission to synchronize.

Plant Link is the result of probing the API itself:

1. `GET /api/v1/health`
2. If that succeeds, `GET /api/v1/health/ready`

Only a successful readiness response sets Plant Link to `READY`. A health failure, including a timeout while cellular internet works, sets `UNREACHABLE`. Health without readiness sets `API_ONLINE`. Before the first probe, the state is `CHECKING`. Each request times out after 5 seconds. The next probe waits 30 seconds after the previous one finishes. Probes do not overlap. The probe does not synchronize.

Synchronization may start only when Plant Link is `READY`. The future reasons to start are a transition into `READY`, an outbox row created while already `READY`, and an explicit Sync Now. There is no Sync Now control yet. One cycle runs at a time. The Plant Link monitor and the sync coordinator are separate. The monitor has the only timer.

The cycle implemented now refreshes the area catalog. Permit push, server pull, attachment upload, and conflict handling are not implemented. Push and pull on the API still return `501`.

## Local database

SQLite is the device working store. PostgreSQL is the plant record. They share UUID identity, permit and event identity, lifecycle names, UTC timestamps, revisions, and module identity. Their physical schemas do not match, and the desktop app never opens PostgreSQL.

The Rust side opens `permit-control.sqlite` with `rusqlite` (bundled SQLite) in the Tauri app-data directory. `app.path().app_data_dir()` uses the bundle identifier `com.lcygroup.permitcontrol`. On Windows that directory is `%APPDATA%\com.lcygroup.permitcontrol`, and the database file is `%APPDATA%\com.lcygroup.permitcontrol\permit-control.sqlite`. The first open creates it. There is no migration from the development identifier `com.tauri.dev`. React calls commands and does not see the path or SQL.

Migration 1 is `src-tauri/src/migrations/001_initial.sql`. `schema_migrations` records the version inside the same transaction that creates the tables. Later versions must be new scripts applied only when the stored version is older. Do not treat `CREATE TABLE IF NOT EXISTS` as an upgrade path.

| Table | What it stores |
| --- | --- |
| `schema_migrations` | Applied versions. |
| `reference_areas` | `id` (server UUID), `name`, nullable `server_updated_at`, `local_updated_at`. No second local id. No enabled flag. |
| `local_permits` | Client UUID, nullable permit number, type, status, nullable area and equipment ids, nullable work order, job description, nullable created by, created and updated times, nullable planned start and expiry, revision, and row sync state. |
| `local_permit_events` | Client UUID, permit id, revision, event type, occurred and recorded times, nullable user, device, and payload, and row sync state. Append-only. Compatible with the central event, not a copy of its columns. |
| `outbox` | Client UUID, event id, entity type, entity id, operation, created time, attempt count, nullable last attempt, status (`PENDING`, `SENDING`, `ACKNOWLEDGED`, `ATTENTION`), nullable last error code. |
| `sync_state` | One row: `last_successful_sync_at`, `last_attempted_sync_at`, `current_sync_state`, and `reference_areas_synced_at`. |

`current_sync_state` is `IDLE`, `PENDING`, `SYNCING`, `BACKOFF`, or `REQUIRES_ATTENTION`. Pending count is the number of outbox rows whose status is not `ACKNOWLEDGED`. It is not a separate counter. The shell shows that count only after SQLite returns it.

`reference_areas_synced_at` is set in the same transaction as a validated catalog replacement. Null means the device has never stored a catalog. A timestamp with zero rows means the server catalog was empty. `last_successful_sync_at` means the last coordinator cycle finished. Today that cycle is the area refresh only. It does not mean permits were pushed.

## Area catalog

The UI reads `reference_areas`. Refresh runs only in a coordinator cycle while Plant Link is `READY`:

1. Receive the complete `GET /api/v1/areas` body.
2. Validate every row. A bad row rejects the whole body.
3. Begin a SQLite transaction.
4. Replace the catalog and set `reference_areas_synced_at`.
5. Commit.
6. The selector reads SQLite again.

A failed, aborted, or invalid refresh does not clear the previous catalog and is not recorded as a successful refresh. Do not delete the old rows before the new payload has been validated and is inside the transaction that will commit them.

The server has no enabled or inactive area. Do not add one on the client. Future removal or deactivation must be an explicit server fact in a complete, validated catalog. The refresh may then omit that area from `reference_areas`. It must not delete `local_permits` rows that still reference the area id, and a failed or partial response must not be read as removal.

Cached areas stay on screen while Plant Link is `UNREACHABLE`, including when the tablet still has cellular internet. If no catalog has ever been stored, New Permit says the reference data has not been synchronized and does not invent areas.

## Local save rule

When the permit editor is connected to this store, one user action must commit all of these in one SQLite transaction:

- the local permit change
- the local domain event
- the outbox row

`LocalDatabase::record_local_change` does that. No screen calls it yet. The commit is the save. Network synchronization happens afterward and must not be required for the save to succeed.

Outbox rows survive process restart. A cycle must not mark a row `ACKNOWLEDGED` until the server has accepted that operation. This pass never acknowledges rows.

## Loss of Plant Link during a cycle

If the API disappears while a cycle is running:

- abort the network cycle
- leave every unacknowledged outbox row in place
- do not mark an unacknowledged operation synchronized
- set Plant Link from the failed probe
- return to the 30-second health and readiness probe
- do not start a tight retry loop

When Plant Link is `READY` again, a new cycle may start. The area refresh follows the same abort rule: an aborted fetch does not replace the catalog.

## Retry

Do not retry aggressively. The Plant Link probe decides when the API is reachable again.

Future transient failures should use a bounded exponential backoff with jitter: timeout, lost connection, HTTP 502, HTTP 503, and HTTP 504. Permanent validation and business-rule conflicts, including HTTP 400 and HTTP 409, must not be retried forever. Those should become `REQUIRES_ATTENTION` or another explicit reconciliation state. Neither the backoff nor the conflict state is applied automatically yet. The columns and the coordinator states are reserved for that behavior.

## Local database failure

Plant Link `UNREACHABLE` is normal offline operation. A SQLite file that cannot be opened, read, or written is not. The application reports `local-store-unavailable` and the shell shows local data unavailable. It does not pretend a save reached the database, it does not keep entering permits into a memory-only substitute, and it does not show the SQL exception to the operator. The native log can hold the diagnostic. Recovery is a later task.

Mock permit screens still use their existing in-memory sample data. That sample data is not a local-database save.

## Push

The client sends events it created, each with a UUID the client generated. `permit_events.id` and `sync_events.id` are that same id. This handler is not implemented.

`sync_events` is the server receipt for that id. Its permit id is optional and is not a foreign key, so a receipt can record accepted activity that is not a permit record. The receipt is not deleted when a permit is retained or closed. See the data model for why it has no permit foreign key.

If the server has already stored the id, the push of that event is a success and a no-op. Retries must not create a second event and must not apply the transition again. `PermitSyncState` in the domain project demonstrates this: a repeated id returns `Duplicate` and leaves status unchanged.

`occurredAt` is when the action happened on the device. `recordedAt` is when the server stored it. Ordering for safety uses `occurredAt`, not arrival order.

## Pull

Pull returns events with `recordedAt` or `occurredAt` after the client's cursor. The client merges by event id and ignores ids it already has. The response shape matches the push event. Pull is not implemented.

## Safety state is not last-write-wins

`SafetyTransitions` is the rule set, and the domain tests cover it.

- `SUSPENDED` does not become `ACTIVE` because an `ACTIVATED`, `AUTHORIZED`, or `ACCEPTED` event arrives later, including one whose `occurredAt` is older than the suspension.
- Leaving `SUSPENDED` requires `REAUTHORIZED`, and that event must not be older than the suspension.
- `CLOSED`, `CANCELLED`, `EXPIRED`, and `SUPERSEDED` do not return to an active or authorized state because a late event says so.
- A rejected transition is still an explicit result (`RejectedStale` or `RejectedTerminal`). The server must not silently apply it. How the client shows that conflict is a later UI task.

Suspension, closure, and reauthorization also have their own tables (`permit_suspensions`, `permit_closures`, `permit_reauthorizations`). Those rows are part of the history. They are not a license to rewrite earlier events.

## What is still TODO

- Server handler that writes `permit_events` and `sync_events` inside one transaction
- Cursor and pull query
- Conflict payload returned to the device, recorded as `REQUIRES_ATTENTION`
- Bounded backoff for transient push failures
- Attachment bytes synced beside the metadata row
- Wiring the permit editor to `record_local_change`
