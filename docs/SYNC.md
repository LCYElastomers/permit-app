# Sync

The sync engine is not implemented. Push and pull return `501`. This note is the contract those handlers must follow.

## Offline first

1. A local operation succeeds from local persistence. The future store is SQLite on the device. It does not exist yet.
2. A missing network does not block data entry, including suspension.
3. The UI must keep working when the API is absent. That is already true: screens use mock data and do not call the API on startup.

## Push

The client sends events it created, each with a UUID the client generated. `permit_events.id` and `sync_events.id` are that same id.

`sync_events` is the server receipt for that id. Its permit id is optional and is not a foreign key, so a receipt can record accepted activity that is not a permit record. The receipt is not deleted when a permit is retained or closed. See the data model for why it has no permit foreign key.

If the server has already stored the id, the push of that event is a success and a no-op. Retries must not create a second event and must not apply the transition again. `PermitSyncState` in the domain project demonstrates this: a repeated id returns `Duplicate` and leaves status unchanged.

`occurredAt` is when the action happened on the device. `recordedAt` is when the server stored it. Ordering for safety uses `occurredAt`, not arrival order.

## Pull

Pull returns events with `recordedAt` or `occurredAt` after the client's cursor. The client merges by event id and ignores ids it already has. The response shape matches the push event.

## Safety state is not last-write-wins

`SafetyTransitions` is the rule set, and the domain tests cover it.

- `SUSPENDED` does not become `ACTIVE` because an `ACTIVATED`, `AUTHORIZED`, or `ACCEPTED` event arrives later, including one whose `occurredAt` is older than the suspension.
- Leaving `SUSPENDED` requires `REAUTHORIZED`, and that event must not be older than the suspension.
- `CLOSED`, `CANCELLED`, `EXPIRED`, and `SUPERSEDED` do not return to an active or authorized state because a late event says so.
- A rejected transition is still an explicit result (`RejectedStale` or `RejectedTerminal`). The server must not silently apply it. How the client shows that conflict is a later UI task.

Suspension, closure, and reauthorization also have their own tables (`permit_suspensions`, `permit_closures`, `permit_reauthorizations`). Those rows are part of the history. They are not a license to rewrite earlier events.

## What is still TODO

- Local outbox table
- Server handler that writes `permit_events` and `sync_events` inside one transaction
- Cursor and pull query
- Conflict payload returned to the device
- Attachment bytes synced beside the metadata row
