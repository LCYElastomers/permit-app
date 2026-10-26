# API

Base path: `/api/v1`. JSON. Development Swagger UI is `/swagger` when `ASPNETCORE_ENVIRONMENT=Development`.

The process listens on `http://localhost:5080` in the local launch profile. There is no production address in the repository.

## Health

`GET /api/v1/health`

```json
{
  "status": "ok",
  "service": "permit-control-api",
  "databaseConfigured": false
}
```

This does not open PostgreSQL and does not echo host, user, or password. `databaseConfigured` is true only when host, database name, user, and password are all set.

`GET /api/v1/health/ready` checks that PostgreSQL accepts a connection. It returns `{ "status": "ready" }` or `503` with `{ "status": "not-ready" }`. The body does not include host, user, password, connection string, or provider errors.

## Identity

`POST /api/v1/identity/sessions` accepts the Windows account reported by the desktop native layer (`domain`, `username`). A unique enabled match returns a session token and the user profile. An unmapped or ambiguous account returns `kind: "select"` and the enabled directory so the person can be chosen. The raw Windows username is not authority for a later lifecycle action.

`POST /api/v1/identity/sessions/confirm` accepts `userId` and `pin` and returns a session only after the PIN is accepted.

`GET /api/v1/identity/session` returns the profile for the bearer token, including `pinState`. `POST /api/v1/identity/pin` enrolls a PIN. Success is `204 No Content` with an empty body. A repeat enrollment while the credential is `ACTIVE` is `400` with `{ "error": "pin-already-enrolled" }` and does not replace the PIN. `POST /api/v1/identity/pin/change` uses the same empty success response. Responses never include a PIN, hash, or salt.

## Users

`GET /api/v1/users` lists profiles for an administrator. `POST /api/v1/users` allocates the next `PCU-` code on the server. `PUT /api/v1/users/{id}` edits the profile. `PUT /api/v1/users/{id}/roles` assigns explicit roles. Sensitive role changes, disable, require-PIN-change, reset enrollment, and unlock require the acting super administrator's PIN. Qualification assignment is `POST /api/v1/users/{id}/qualifications`.

## Permits

`GET /api/v1/permits?status=` lists plant records for one status, including revision, module names, approval snapshots, and missing specialty qualifications. `GET /api/v1/permits/{id}` returns one record.

`POST /api/v1/permits/{id}/submit` moves a draft to `PENDING_REVIEW` for the session user. It does not accept a user id in the body.

`POST /api/v1/permits/{id}/authorize`, `/accept`, and `/activate` require the bearer session, an active PIN, the current revision, and the capability for that action. The body PIN is not logged. `AUTHORIZED` is not work authorization. Only `ACTIVE` is work authorized.

`POST /api/v1/permits` remains the unimplemented create skeleton and returns `501` with `{ "error": "not-implemented" }` when a database is configured. Permit creation still arrives through `PERMIT_CREATED` sync.

Until a database is configured these routes return `503` with `{ "error": "database-not-configured" }`. A missing or rejected session is `401` with `{ "error": "session-required" }` or `{ "error": "pin-not-accepted" }`. A missing capability is `403` with `{ "error": "capability-required" }`.

## Areas

`GET /api/v1/areas` returns every area ordered by `name`, then `id`. The `areas` table has no enabled flag, so there is no inactive subset to hide.

```json
[
  { "id": "0b6d1a22-1111-4a1b-9c1d-111111111111", "name": "Unit 1" }
]
```

`GET /api/v1/areas/{id}` returns one object of that shape. A missing area is `404` with `{ "error": "area not found" }`. An id that is not a UUID, or the empty UUID, is `400` with `{ "error": "id is invalid" }`.

`POST /api/v1/areas`

```json
{ "name": "Tank Farm", "id": "0b6d1a22-1111-4a1b-9c1d-111111111111" }
```

`id` is optional. When it is omitted the server generates a UUID. The stored name is trimmed. A missing or whitespace-only name is `400` with `{ "error": "name is required" }`. A name longer than 120 characters is `400` with `{ "error": "name is too long" }`. The empty UUID is `400` with `{ "error": "id is invalid" }`.

Success is `201 Created` with the area body and a `Location` of `/api/v1/areas/{id}`. An existing name or id is `409`. Name uniqueness matches the case-sensitive unique index on `areas."Name"`.

When the database is not configured these routes return `503` with `{ "error": "database-not-configured" }`. A database failure returns `503` with `{ "error": "database-unavailable" }` and does not include the provider message. There is no authentication yet. The controller is the place to add reference-data authorization later.

## Other reference data and archive

```
GET /api/v1/equipment
GET /api/v1/contractors
GET /api/v1/archive
GET /api/v1/archive/{id}
```

Success shapes, once implemented:

- equipment: `[{ "id", "areaId", "tag", "name" }]`
- contractors: `[{ "id", "name" }]`
- archive: the permit list shape, limited to closed, cancelled, expired, and superseded permits

Those routes still use `503` when the database is not configured and `501` with `{ "error": "not-implemented" }` when it is.

## Permit PDF

`POST /api/v1/permits/{id}/exports/pdf`

```json
{ "exportType": "PRINT" }
```

`exportType` may be omitted or `PRINT` or `SNAPSHOT`. `FINAL_ARCHIVE` is `400` with `{ "error": "final-archive-not-available" }`. A missing permit is `404` with `{ "error": "permit not found" }`. A supported permit type is rendered from its stored module facts. An unknown type is `400` with `{ "error": "permit-type-invalid" }`.

Success returns export metadata. It does not return a filesystem path or storage key.

```json
{
  "id": "11111111-2222-3333-4444-555555555555",
  "permitId": "0b6d1a22-1111-4a1b-9c1d-111111111111",
  "permitRevision": 1,
  "exportType": "PRINT",
  "mimeType": "application/pdf",
  "fileSize": 12000,
  "sha256": "abc",
  "generatedAt": "2026-10-22T20:15:00Z",
  "filename": "PTW-2026-00001-General-Work-Rev-01.pdf"
}
```

`GET /api/v1/permit-exports/{exportId}/content` returns `application/pdf` with that download filename. A missing export is `404`. Database or file-storage failure is `503` and does not include a path.

## Sync

`POST /api/v1/sync/push`

```json
{
  "events": [
    {
      "id": "8a1d9b2c-3333-4a1b-9c1d-333333333333",
      "permitId": "6f1c1c3e-8b2a-4c1d-9a0e-1b2c3d4e5f60",
      "permitRevision": 3,
      "eventType": "SUSPENDED",
      "occurredAt": "2026-10-21T19:07:00Z",
      "userId": null,
      "deviceId": null,
      "payload": null
    }
  ]
}
```

`GET /api/v1/sync/pull?since=2026-10-21T18:00:00Z`

Push accepts exactly one event. `PERMIT_CREATED` creates a supported permit type and stores current module values as module facts. `PERMIT_SUBMITTED` moves that same permit from draft to pending review and does not allocate another permit number. Specialty values are not stored in the event payload. Pull still returns `501` with `{ "error": "sync-not-implemented" }`. A missing or empty `events` array on push is `400`. More than one event is `400` with `{ "error": "single-event-required" }`. The request and acknowledgement are described in `docs/SYNC.md`. Operational lists read `GET /api/v1/permits?status=` for `DRAFT`, `PENDING_REVIEW`, `AUTHORIZED`, `ACTIVE`, and `SUSPENDED` when Plant Link is ready.

## Client

`src/lib/api/` wraps these paths. `VITE_PERMIT_API_URL` overrides the production default `https://permit-control.local`. Connectivity, area refresh, and permit PDF generation go through services. The PDF content request downloads bytes. It does not print the screen. Local drafts of every supported permit type are saved on the device. Pending, active, and suspended lists still include station samples. A missing API does not stop the desktop app.

## Administration

`/api/v1/administration` requires an administrator session. Catalog routes cover areas, equipment, contractors, work types, templates, hazards, controls, and PPE. Form routes cover fields, choices, publish, rules, and the published version. `GET /permit-types` lists the six system permit types and their modules. Publishing a form and saving a rule require the administrator PIN. Ordinary catalog edits use the session. The API does not run SQL or shell commands and does not return a connection string, token hash, or PIN hash.

## Not exposed

There is no username and password login, no file-upload route, and no endpoint that returns a connection string.
