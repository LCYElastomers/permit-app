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

Migration 1 is `src-tauri/src/migrations/001_initial.sql`. Migration 2 is `src-tauri/src/migrations/002_general_work.sql`. `schema_migrations` records each version inside the same transaction that applies that script. Later versions must be new scripts applied only when the stored version is older. Do not treat `CREATE TABLE IF NOT EXISTS` as an upgrade path.

| Table | What it stores |
| --- | --- |
| `schema_migrations` | Applied versions. |
| `reference_areas` | `id` (server UUID), `name`, nullable `server_updated_at`, `local_updated_at`. No second local id. No enabled flag. |
| `local_permits` | Client UUID, nullable permit number, type, status, nullable area id, area name snapshot, equipment tag, work order, job description, company type and name, requester, craft, created and updated times, planned start and expiry, revision, row sync state, and versioned `working_state`. |
| `local_permit_events` | Client UUID, permit id, revision, event type, occurred and recorded times, nullable user, device, and payload, and row sync state. Append-only. Compatible with the central event, not a copy of its columns. |
| `outbox` | Client UUID, event id, entity type, entity id, operation, created time, attempt count, nullable last attempt, status (`PENDING`, `SENDING`, `ACKNOWLEDGED`, `ATTENTION`), nullable last error code. |
| `sync_state` | One row: `last_plant_contact_at`, `last_reference_sync_at`, `last_permit_sync_at`, `last_attempted_sync_at`, `current_sync_state`, and `reference_areas_synced_at`. `last_successful_sync_at` remains from migration 1 and is not written. |

`current_sync_state` is `IDLE`, `PENDING`, `SYNCING`, `BACKOFF`, or `REQUIRES_ATTENTION`. Pending count is the number of outbox rows whose status is not `ACKNOWLEDGED`. It is not a separate counter. The shell shows that count only after SQLite returns it.

These times are different facts:

- `last_plant_contact_at` is the last time the API process answered a health or readiness probe. It is not a sync.
- `last_reference_sync_at` and `reference_areas_synced_at` are set in the same transaction as a validated area-catalog replacement. Null means the device has never stored a catalog. A timestamp with zero rows means the server catalog was empty.
- `last_permit_sync_at` stays null until a future permit push is accepted by the plant record. An area refresh must not set it.

The interface does not show a generic last-sync time. A reference refresh is not a permit upload.

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

## General Work drafts

Save Draft is a local operation. It does not call the API, and it does not require Plant Link `READY` or general internet. Plant Link changes only the sentence shown after a successful save.

Opening New Permit does not insert a row. The first Save Draft for a General Work form commits, in one SQLite transaction:

- a `local_permits` row with status `DRAFT`, type `GENERAL_WORK`, a client UUID, and a null permit number
- a `PERMIT_CREATED` event with its own client UUID, the permit id, revision 1, `occurred_at`, and `recorded_at`
- a `PENDING` outbox row for that event

The event payload is null. The permit row is the current working state. The event records that the draft was created. `record_local_change` remains the generic atomic insert. General Work creation uses the same transaction shape in `save_general_work_draft`, including the working-state columns from migration 2.

A later Save Draft updates that permit row and `working_state` only. It does not write another event or outbox row. There is no per-keystroke autosave. That keeps the audit trail to the creation, which is the fact the plant record does not have yet. When permit push exists, it should send the current permit row, not rebuild the draft from the event payload.

The outbox row stays `PENDING` after an area refresh and after Plant Link becomes `READY`. This pass never writes `ACKNOWLEDGED` and never sets `last_permit_sync_at`.

Searchable header fields live in columns: area id, area name snapshot, equipment tag, work order, job description, company type, company, requester, craft, planned start, planned expiration, revision, and timestamps. The rest of the General Work form is `working_state`, JSON with `"version": 1`. Version 1 holds the workflow step, hazards, controls, detail fields (including the General Work exclusion answers), names, and signatures. Unknown versions are rejected and are not written. The official permit number stays null. The screen may say `LOCAL DRAFT` and show the first eight characters of the local id. That is not a PTW number.

If the transaction fails, the form stays on screen and the footer says the draft could not be saved on this device. The operator does not see SQL.

## Local save rule

`LocalDatabase::record_local_change` commits a permit, event, and outbox row in one transaction. General Work creation does the same with its extra columns. The commit is the save. Network synchronization happens afterward and must not be required for the save to succeed.

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

A lost connection, timeout, or HTTP 502, 503, or 504 leaves the outbox row `PENDING`, increments its attempt count, and sets the coordinator state to `BACKOFF`. The cycle does not schedule its own retry timer. The next transition to `READY`, or another local Save Draft while Plant Link is already `READY`, may run again. HTTP 400 and 409 move that outbox row to `ATTENTION` with a short error code such as `unknown-area` or `permit-already-created`. The operator sees `NEEDS ATTENTION`. The code is not a database message. Those rows are not sent again. Other pending rows still sync. Acknowledged rows are kept. This pass does not delete them.

## Local database failure

Plant Link `UNREACHABLE` is normal offline operation. A SQLite file that cannot be opened, read, or written is not. The application reports `local-store-unavailable` and the shell shows local data unavailable. It does not pretend a save reached the database, it does not keep entering permits into a memory-only substitute, and it does not show the SQL exception to the operator. The native log can hold the diagnostic. Recovery is a later task.

Mock permit screens still use their existing in-memory sample data. That sample data is not a local-database save.

## Push

`POST /api/v1/sync/push` accepts one General Work `PERMIT_CREATED` event. The client sends it only while Plant Link is `READY`, after the local save has committed. Save Draft does not wait for this call.

```json
{
  "events": [
    {
      "id": "55555555-5555-4555-8555-111111111111",
      "permitId": "44444444-4444-4444-8444-111111111111",
      "permitRevision": 1,
      "eventType": "PERMIT_CREATED",
      "occurredAt": "2026-10-22T17:00:00Z",
      "userId": null,
      "deviceId": null,
      "permit": {
        "permitType": "GENERAL_WORK",
        "areaId": "0b6d1a22-1111-4a1b-9c1d-111111111111",
        "areaName": "Unit 2",
        "equipmentTag": "P-210",
        "workOrder": "WO-104700",
        "jobDescription": "Gauge glass inspection",
        "companyType": "CONTRACTOR",
        "companyName": "Gulf Industrial Services",
        "requester": "Elena Voss",
        "craft": "Jordan Peck",
        "plannedStartClock": "15:00",
        "plannedExpirationClock": "19:00",
        "hazards": ["slip/trip"],
        "controls": ["barricade"],
        "ppe": ["Gloves"],
        "taskType": "Inspection",
        "exclusions": { "excludeOpening": "excluded" }
      }
    }
  ]
}
```

`id` is the client event UUID and the idempotency key. `permitId` is the client permit UUID. The response is:

```json
{
  "acknowledgements": [
    {
      "eventId": "55555555-5555-4555-8555-111111111111",
      "permitId": "44444444-4444-4444-8444-111111111111",
      "permitNumber": "PTW-2026-00001",
      "permitRevision": 1,
      "result": "accepted"
    }
  ]
}
```

`result` is `accepted` or `duplicate`. A duplicate returns the original permit number. The client writes that number onto the local permit, marks the outbox `ACKNOWLEDGED`, leaves the status `DRAFT`, and sets `last_permit_sync_at`. An area refresh does not set that timestamp.

The server year in `PTW-YYYY-NNNNN` is the UTC year of first acceptance. The sequence lives in `permit_number_counters`, one row per year. Allocation is `INSERT ... ON CONFLICT ("Year") DO UPDATE SET "LastValue" = "LastValue" + 1 RETURNING "LastValue"` inside the same transaction as the permit. The width is at least five digits. A rolled-back transaction does not keep the number. A retry does not allocate another one.

The same transaction inserts the permit, revision 1, the `PERMIT_CREATED` event, hazard, control, PPE, and participant rows, the implied modules, and the `sync_events` receipt. The receipt id is the event id. Validation failure and an unknown area return before that receipt exists. `created_by` stays null until authentication exists. Planned clock times are not stored as `timestamptz` columns because the device only has a time of day. An unknown area id is `400` `unknown-area` and does not create an area from the name snapshot.

Relational rows hold the header, people, hazards, controls, PPE, and modules (`CORE`, and `HAZARD_ASSESSMENT`, `PPE`, or `WORKING_AT_HEIGHT` when those facts are present). The event payload is a server document named `general-work-facts`, not the device `working_state` blob. It keeps the equipment tag, company name, clock times, task and process fields, height text, and exclusion answers. There is still no equipment-tag column, no free-text company column, and no column for those detail answers. Workflow step and signatures stay on the device. Signatures are not an authorization record.

`sync_events.permit_id` is still not a foreign key. Pull remains unimplemented.

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

- Cursor and pull query
- Submission, authorization, activation, suspension, extension, reauthorization, closure, and other permit types
- Attachment bytes synced beside the metadata row
- Automatic deletion of acknowledged outbox rows
