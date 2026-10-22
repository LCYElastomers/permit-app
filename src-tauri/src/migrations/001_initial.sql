CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
);

CREATE TABLE reference_areas (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    server_updated_at TEXT,
    local_updated_at TEXT NOT NULL
);

CREATE TABLE local_permits (
    id TEXT PRIMARY KEY NOT NULL,
    permit_number TEXT,
    permit_type TEXT NOT NULL,
    status TEXT NOT NULL,
    area_id TEXT,
    equipment_id TEXT,
    work_order TEXT,
    job_description TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    planned_start TEXT,
    expires_at TEXT,
    current_revision INTEGER NOT NULL,
    sync_state TEXT NOT NULL
);

CREATE TABLE local_permit_events (
    id TEXT PRIMARY KEY NOT NULL,
    permit_id TEXT NOT NULL,
    permit_revision INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    user_id TEXT,
    device_id TEXT,
    payload TEXT,
    sync_state TEXT NOT NULL
);

CREATE INDEX idx_local_permit_events_permit_id ON local_permit_events (permit_id);

CREATE TABLE outbox (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENDING', 'ACKNOWLEDGED', 'ATTENTION')),
    last_error_code TEXT
);

CREATE INDEX idx_outbox_status ON outbox (status);

CREATE TABLE sync_state (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    last_successful_sync_at TEXT,
    last_attempted_sync_at TEXT,
    current_sync_state TEXT NOT NULL CHECK (
        current_sync_state IN ('IDLE', 'PENDING', 'SYNCING', 'BACKOFF', 'REQUIRES_ATTENTION')
    ),
    reference_areas_synced_at TEXT
);

INSERT INTO sync_state (
    id,
    last_successful_sync_at,
    last_attempted_sync_at,
    current_sync_state,
    reference_areas_synced_at
) VALUES (
    1,
    NULL,
    NULL,
    'IDLE',
    NULL
);
