# Data model

The schema is a permit domain, not a copy of a paper form. A permit has one classification, a lifecycle status, and zero or more modules. Historical facts are rows, not overwritten columns.

Identity is a client-generated UUID. `PermitNumber` (for example `PTW-2026-00142`) is a separate human identifier and is unique. There is no integer primary key.

Timestamps are `timestamptz`. Enumerations are stored as strings such as `GENERAL_WORK` and `SUSPENDED`.

`jsonb` is used only for `permit_events.payload`, which carries the optional body of an append-only event.

## Identity and reference data

| Table | Purpose |
| --- | --- |
| `users` | Permit Control person. `id` is a server UUID. `permit_user_code` (`PCU-0001` and onward) is the immutable human identifier, unique, and never recycled. `username` is the normalized Windows account key. `windows_domain` and `windows_username` map the Windows account. Profile fields (`display_name`, personnel reference and code, job title, department, enabled) are editable. `auth_provider` is `LOCAL` now and can be `ENTRA` later. There is no password column and no PIN column. |
| `roles` | Named application role: `SUPER_ADMIN`, `ADMIN`, `REQUESTER`, `PERMIT_AUTHORIZER`, `SHIFT_SUPERVISOR`, `CRAFT_RECEIVER`, `SAFETY`, `VIEWER`. |
| `user_roles` | Explicit user-to-role assignment. Job title does not create these rows. `ON DELETE RESTRICT`. |
| `user_credentials` | One current PIN credential per user: Argon2id hash, state, failed attempts, lock expiry, and the state to resume after lockout. The hash is never returned. |
| `user_pin_history` | Previous Argon2id hashes used to reject reuse. Not plaintext and not returned. |
| `user_qualifications` | Qualification held by a user. Separate from roles. |
| `credential_audits` | Non-sensitive PIN audit: target user, actor, time, device, and a result code. No PIN and no hash. |
| `user_sessions` | Opaque desktop session. The stored value is a SHA-256 of the bearer token, not a PIN hash. |
| `user_code_counters` | Server allocation of the next `PCU-` code. Seeded at 8 so the next created user is `PCU-0009`. |
| `permit_policies` | Named policy. `AllowSelfAuthorization` is false until changed. |
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

Event types include `PERMIT_CREATED`, `PERMIT_UPDATED`, `JSA_VERIFIED`, `ISOLATION_VERIFIED`, `ATMOSPHERE_TEST_RECORDED`, `SUBMITTED`, `AUTHORIZED`, `ACCEPTED`, `ACTIVATED`, `SUSPENDED`, `REAUTHORIZED`, `EXTENDED`, `WORK_COMPLETED`, `CLOSED`, `ATTACHMENT_ADDED`, `ATTACHMENT_SUPERSEDED`, `ADMINISTRATIVE_AMENDMENT`, `PERMIT_SUBMITTED`, `PERMIT_AUTHORIZED`, `PERMIT_ACCEPTED`, `PERMIT_ACTIVATED`, `PERMIT_SUSPENDED`, `PERMIT_REAUTHORIZED`, `PERMIT_EXTENDED`, `PERMIT_CLOSED`, and `PERMIT_CANCELLED`.

Lifecycle events and `permit_approvals` also store attribution snapshots: Permit Control user code, display name, job title, acting role, and Windows username. Later profile edits do not rewrite those columns. `permit_approvals.user_id` is `ON DELETE RESTRICT`.

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

`permit_module_facts` is the current value of one named module field: permit id, module kind, name, and value. It is not an event. Specialty permit details are written here when a permit is accepted. The foreign key to `permits` is `ON DELETE RESTRICT`.

`permit_exports` is one generated PDF: permit id, revision, export type (`PRINT`, `SNAPSHOT`, or the reserved `FINAL_ARCHIVE`), storage key, MIME type, byte size, SHA-256 of the PDF bytes, generation time, nullable generated-by, and the permit status at generation. A new generation inserts a new row. The foreign key to `permits` is `ON DELETE RESTRICT`.

`devices` identifies a client station. `sync_events` records that the server accepted a client event id. `PermitId` on that table is nullable and is not a foreign key. A sync event is an idempotency receipt, not a historical child of a permit. When the accepted event belongs to a permit, the receipt uses the same id as `permit_events` and may store that permit id. A null permit id is valid for accepted activity that does not belong to a permit. `ON DELETE CASCADE` would erase the receipt and let a retry look new. `ON DELETE RESTRICT` would block permit deletion because of the sync log rather than because permit history still exists. The sync engine that writes these rows is not implemented.

## Referential integrity

Every permit child foreign key uses `ON DELETE RESTRICT`. Deleting a `permits` row is rejected while any of these rows still reference it: `atmospheric_tests`, `attachments`, `isolations`, `permit_approvals`, `permit_events`, `permit_modules`, `permit_participants`, `permit_revisions`, `permit_hazards`, `permit_controls`, `permit_ppe`, `permit_suspensions`, `permit_extensions`, `permit_reauthorizations`, `permit_closures`, `permit_exports`, and `permit_module_facts`. Normal outcomes are status changes (`CLOSED`, `CANCELLED`, `EXPIRED`, `SUPERSEDED`), not physical deletion.

`user_roles`, credentials, PIN history, qualifications, credential audits, sessions, and permit approvals restrict deletion of the user. Disabling a user is the normal outcome. Physical deletion must not cascade permit history, approvals, exports, or audit rows. `permits` references to areas, equipment, contractors, and users are also `ON DELETE RESTRICT`.

## Device working state

The desktop store is not a second copy of this PostgreSQL schema. General Work drafts keep the searchable header in SQLite columns and the rest of the open form in `local_permits.working_state`. That value is JSON with a version. Version 1 stores the workflow step, hazards, controls, detail fields, names, and signatures so the draft can be reopened on the device. The first successful `PERMIT_CREATED` push copies the header, people, hazards, controls, and PPE into the tables above and writes the remaining facts into `permit_events.payload` as `general-work-facts`. It does not store the device JSON document. The official `permit_number` is assigned by `permit_number_counters` on that acceptance. A draft may omit the area, the creator, and the planned window, so those permit columns are nullable. Details are in `docs/SYNC.md`.

## PIN credentials

PIN values are not stored. The current and historical credentials use Isopoh.Cryptography.Argon2 2.0.0 (MIT) with Argon2id, a unique 16-byte salt, 8192 KiB memory, time cost 2, and one lane. The encoded hash begins with `$argon2id$`. SQLite, permit events, the outbox, logs, and API responses do not contain the PIN, the hash, or the salt.

## Migration

`PermitControl.Infrastructure` contains the EF Core migrations `InitialFoundation`, `GeneralWorkPermitSync`, `PermitPdfExport`, `PermitModuleFacts`, `20261023145009_UserDirectory`, and `20261023171410_AdministrationCatalogs`. Applying them requires a PostgreSQL database and is not part of the build. The unapplied scripts are `server/permit-user-directory.sql` and `server/permit-administration.sql`. Apply the user-directory script before the administration script. Do not re-apply `server/permit-pdf-export.sql` or `server/permit-module-facts.sql` if those have already been applied.

## Administration catalogs

Areas, equipment, and contractors carry `enabled`. A referenced row is disabled rather than deleted, and its historical name or tag is kept. Work types, hazards, controls, PPE, and permit templates are configurable catalogs and start empty. Field definitions and choices are versioned. Publishing advances `form_publications.published_version`. A permit stores `form_configuration_version` and is not rewritten when a later form is published. A permit rule stores a condition code, a condition value, and a fixed action. It does not store an executable expression. `configuration_audits` records the actor, action, entity, and a short summary. It does not store a PIN.
