# Data model

The schema is a permit domain, not a copy of a paper form. A permit has one classification, a lifecycle status, and zero or more modules. Historical facts are rows, not overwritten columns.

Identity is a client-generated UUID. `PermitNumber` (for example `PTW-2026-00142`) is a separate human identifier and is unique. There is no integer primary key.

Timestamps are `timestamptz`. Enumerations are stored as strings such as `GENERAL_WORK` and `SUSPENDED`.

`jsonb` is used only for `permit_events.payload`, which carries the optional body of an append-only event.

## Identity and reference data

| Table | Purpose |
| --- | --- |
| `users` | Person known to the API. `auth_provider` is `LOCAL` now and can be `ENTRA` later. There is no password column. |
| `roles` | Named role. |
| `user_roles` | User-to-role assignment. |
| `areas` | Plant area. `name` is unique and required, up to 120 characters. There is no enabled flag. The desktop cache stores the same id and name in SQLite `reference_areas`. A future removal or deactivation has to be an explicit server fact. The cache must not invent an inactive flag, and dropping an area from the cache must not delete local permit history that still references that id. See `docs/SYNC.md`. |
| `equipment` | Tagged equipment in an area. |
| `contractors` | Contractor company. |

## Permit

`permits` holds the searchable header:

- `id`, `permit_number`, `permit_type`, `status`
- `area_id`, nullable `equipment_id`
- `work_order`, `job_description`
- `company_type`, nullable `contractor_id`
- `created_by`, `created_at`, `updated_at`
- `planned_start`, `expires_at`
- nullable `activated_at`, nullable `closed_at`
- `current_revision`

Classifications: `GENERAL_WORK`, `HOT_WORK`, `CONFINED_SPACE`, `OPENING_BLINDING`, `EXCAVATION`, `LIVE_ELECTRICAL`.

Statuses: `DRAFT`, `PENDING_REVIEW`, `AUTHORIZED`, `ACTIVE`, `SUSPENDED`, `CLOSED`, `CANCELLED`, `EXPIRED`, `SUPERSEDED`.

Indexes: unique `permit_number`, plus `status`, `permit_type`, `area_id`, `equipment_id`, `work_order`, `created_at`, `closed_at`.

## Revisions and events

`permit_revisions` is one row per revision number for a permit.

`permit_events` is append-only. Columns include `permit_id`, `permit_revision`, `event_type`, `occurred_at`, `recorded_at`, nullable `user_id`, nullable `device_id`, nullable `payload` (`jsonb`), and `sync_source` (`CLIENT` or `SERVER`). The event `id` is the client-generated idempotency key. The application does not update or delete these rows.

Event types include `PERMIT_CREATED`, `PERMIT_UPDATED`, `JSA_VERIFIED`, `ISOLATION_VERIFIED`, `ATMOSPHERE_TEST_RECORDED`, `SUBMITTED`, `AUTHORIZED`, `ACCEPTED`, `ACTIVATED`, `SUSPENDED`, `REAUTHORIZED`, `EXTENDED`, `WORK_COMPLETED`, `CLOSED`, `ATTACHMENT_ADDED`, `ATTACHMENT_SUPERSEDED`, and `ADMINISTRATIVE_AMENDMENT`.

## People, modules, and controls

| Table | Purpose |
| --- | --- |
| `permit_participants` | Named role on a permit. |
| `permit_approvals` | A decision for a role. |
| `permit_modules` | A module kind attached to the permit, and whether it is required. |
| `permit_hazards` | Hazard label, optional module. |
| `permit_controls` | Control label, optional module. |
| `permit_ppe` | PPE label. |

Module kinds: `CORE`, `JSA`, `PROCEDURE`, `HAZARD_ASSESSMENT`, `PPE`, `LOTO_ISOLATION`, `ATMOSPHERIC_MONITORING`, `HOT_WORK`, `FIRE_WATCH`, `CONFINED_SPACE`, `RESCUE`, `EXCAVATION`, `OPENING_BLINDING`, `LIVE_ELECTRICAL`, `WORKING_AT_HEIGHT`.

## Readings, isolation, and lifecycle records

`atmospheric_tests` is one row per reading. There are no `Test1` / `Test2` columns. Fields: tested time, nullable oxygen percent, LEL percent, carbon monoxide ppm, tester, result (`RECORDED`, `PASS`, or `FAIL`), and notes. This pass does not define pass/fail limits. `PASS` and `FAIL` are stored only when a client already recorded that judgment.

`isolations` stores the energy-control plan, lock box, and when zero energy was verified.

`permit_suspensions`, `permit_extensions`, `permit_reauthorizations`, and `permit_closures` are separate records of those actions. A closure is unique per permit.

## Files, devices, sync

`attachments` stores metadata only: original name, stored name, `storage_provider` (`LOCAL_SERVER`), storage key, MIME type, size, SHA-256, author, time, and nullable `superseded_by`. File bytes are not a `bytea` column.

`permit_exports` is one generated PDF: permit id, revision, export type (`PRINT`, `SNAPSHOT`, or the reserved `FINAL_ARCHIVE`), storage key, MIME type, byte size, SHA-256 of the PDF bytes, generation time, nullable generated-by, and the permit status at generation. A new generation inserts a new row. The foreign key to `permits` is `ON DELETE RESTRICT`.

`devices` identifies a client station. `sync_events` records that the server accepted a client event id. `PermitId` on that table is nullable and is not a foreign key. A sync event is an idempotency receipt, not a historical child of a permit. When the accepted event belongs to a permit, the receipt uses the same id as `permit_events` and may store that permit id. A null permit id is valid for accepted activity that does not belong to a permit. `ON DELETE CASCADE` would erase the receipt and let a retry look new. `ON DELETE RESTRICT` would block permit deletion because of the sync log rather than because permit history still exists. The sync engine that writes these rows is not implemented.

## Referential integrity

Every permit child foreign key uses `ON DELETE RESTRICT`. Deleting a `permits` row is rejected while any of these rows still reference it: `atmospheric_tests`, `attachments`, `isolations`, `permit_approvals`, `permit_events`, `permit_modules`, `permit_participants`, `permit_revisions`, `permit_hazards`, `permit_controls`, `permit_ppe`, `permit_suspensions`, `permit_extensions`, `permit_reauthorizations`, `permit_closures`, and `permit_exports`. Normal outcomes are status changes (`CLOSED`, `CANCELLED`, `EXPIRED`, `SUPERSEDED`), not physical deletion.

`user_roles` still cascades when its user or role is deleted. That removes membership rows only. `permits` references to areas, equipment, contractors, and users are also `ON DELETE RESTRICT`.

## Device working state

The desktop store is not a second copy of this PostgreSQL schema. General Work drafts keep the searchable header in SQLite columns and the rest of the open form in `local_permits.working_state`. That value is JSON with a version. Version 1 stores the workflow step, hazards, controls, detail fields, names, and signatures so the draft can be reopened on the device. The first successful `PERMIT_CREATED` push copies the header, people, hazards, controls, and PPE into the tables above and writes the remaining facts into `permit_events.payload` as `general-work-facts`. It does not store the device JSON document. The official `permit_number` is assigned by `permit_number_counters` on that acceptance. A draft may omit the area, the creator, and the planned window, so those permit columns are nullable. Details are in `docs/SYNC.md`.

## Migration

`PermitControl.Infrastructure` contains the EF Core migration `InitialFoundation`. Applying it requires a PostgreSQL database and is not part of the build.
