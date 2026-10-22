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

## Permits

`GET /api/v1/permits`

```json
{ "items": [] }
```

Each item:

```json
{
  "id": "6f1c1c3e-8b2a-4c1d-9a0e-1b2c3d4e5f60",
  "permitNumber": "PTW-2026-00142",
  "permitType": "CONFINED_SPACE",
  "status": "ACTIVE",
  "areaId": "0b6d1a22-1111-4a1b-9c1d-111111111111",
  "equipmentId": "0b6d1a22-2222-4a1b-9c1d-222222222222",
  "workOrder": "WO-104583",
  "jobDescription": "Internal vessel inspection and maintenance",
  "plannedStart": "2026-10-21T18:34:00Z",
  "expiresAt": "2026-10-22T00:00:00Z",
  "closedAt": null
}
```

`GET /api/v1/permits/{id}` returns one summary.

`POST /api/v1/permits` accepts the same fields plus `companyType` (`LCY` or `CONTRACTOR`), nullable `contractorId`, and `createdBy`. The client supplies `id`. Missing `id`, `permitNumber`, or `jobDescription` is `400`.

Until a database is configured these routes return `503` with `{ "error": "database-not-configured" }`. When a database is configured and the handler is still a skeleton, they return `501` with `{ "error": "not-implemented" }`.

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

`exportType` may be omitted or `PRINT` or `SNAPSHOT`. `FINAL_ARCHIVE` is `400` with `{ "error": "final-archive-not-available" }`. A missing permit is `404` with `{ "error": "permit not found" }`. A permit that is not General Work is `400` with `{ "error": "general-work-only" }`.

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

Push accepts exactly one `PERMIT_CREATED` event for a General Work draft. Pull still returns `501` with `{ "error": "sync-not-implemented" }`. A missing or empty `events` array on push is `400`. More than one event is `400` with `{ "error": "single-event-required" }`. The request and acknowledgement are described in `docs/SYNC.md`.

## Client

`src/lib/api/` wraps these paths. `VITE_PERMIT_API_URL` overrides the production default `https://permit-control.local`. Connectivity, area refresh, and permit PDF generation go through services. The PDF content request downloads bytes. It does not print the screen. The other screens still use mock permit data, so a missing API does not stop the desktop app.

## Not exposed

There is no authentication scheme, no file-upload route, and no endpoint that returns a connection string.
