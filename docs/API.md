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

## Reference data and archive

```
GET /api/v1/areas
GET /api/v1/equipment
GET /api/v1/contractors
GET /api/v1/archive
GET /api/v1/archive/{id}
```

Success shapes, once implemented:

- areas: `[{ "id", "name" }]`
- equipment: `[{ "id", "areaId", "tag", "name" }]`
- contractors: `[{ "id", "name" }]`
- archive: the permit list shape, limited to closed, cancelled, expired, and superseded permits

Today they use the same `503` / `501` behavior as the permit routes.

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

Both return `501` with `{ "error": "sync-not-implemented" }`. A missing `events` array on push is `400`. The intended conflict rules are in `docs/SYNC.md`.

## Client

`src/lib/api/` wraps these paths. `VITE_PERMIT_API_URL` overrides the default `http://127.0.0.1:5080`. The React screens do not call the client yet, so a missing API does not affect the mock UI.

## Not exposed

There is no authentication scheme, no file-upload route, and no endpoint that returns a connection string.
