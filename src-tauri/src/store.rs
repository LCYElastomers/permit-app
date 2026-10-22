use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

const MIGRATION_1: &str = include_str!("migrations/001_initial.sql");
const AREA_NAME_MAX: usize = 120;

pub const DATABASE_FILE_NAME: &str = "permit-control.sqlite";

#[derive(Debug)]
pub enum StoreError {
    Unavailable,
    InvalidCatalog,
    #[allow(dead_code)]
    InvalidChange,
    InvalidPhase,
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message = match self {
            StoreError::Unavailable => "local store unavailable",
            StoreError::InvalidCatalog => "invalid area catalog",
            StoreError::InvalidChange => "invalid local change",
            StoreError::InvalidPhase => "invalid sync phase",
        };
        formatter.write_str(message)
    }
}

pub struct LocalDatabase {
    conn: Connection,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AreaInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub server_updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AreaRow {
    pub id: String,
    pub name: String,
    pub server_updated_at: Option<String>,
    pub local_updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStatus {
    pub pending_count: i64,
    pub sync_state: String,
    pub last_successful_sync_at: Option<String>,
    pub last_attempted_sync_at: Option<String>,
    pub reference_areas_synced_at: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct LocalPermitChange {
    pub id: String,
    pub permit_number: Option<String>,
    pub permit_type: String,
    pub status: String,
    pub area_id: Option<String>,
    pub equipment_id: Option<String>,
    pub work_order: Option<String>,
    pub job_description: String,
    pub created_by: Option<String>,
    pub planned_start: Option<String>,
    pub expires_at: Option<String>,
    pub current_revision: i64,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct LocalEventChange {
    pub id: String,
    pub permit_id: String,
    pub permit_revision: i64,
    pub event_type: String,
    pub occurred_at: String,
    pub user_id: Option<String>,
    pub device_id: Option<String>,
    pub payload: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct OutboxChange {
    pub id: String,
    pub event_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: String,
}

impl LocalDatabase {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StoreError> {
        let conn = Connection::open(path).map_err(fail)?;
        conn.pragma_update(None, "journal_mode", "WAL").map_err(fail)?;
        conn.pragma_update(None, "foreign_keys", "ON").map_err(fail)?;
        conn.busy_timeout(Duration::from_secs(5)).map_err(fail)?;
        migrate(&conn).map_err(fail)?;
        Ok(Self { conn })
    }

    #[allow(dead_code)]
    pub fn schema_version(&self) -> Result<i64, StoreError> {
        current_version(&self.conn).map_err(fail)
    }

    pub fn status(&self) -> Result<LocalStatus, StoreError> {
        let pending_count = self.pending_count()?;
        self.conn
            .query_row(
                "SELECT current_sync_state, last_successful_sync_at, last_attempted_sync_at, reference_areas_synced_at
                 FROM sync_state WHERE id = 1",
                [],
                |row| {
                    Ok(LocalStatus {
                        pending_count,
                        sync_state: row.get(0)?,
                        last_successful_sync_at: row.get(1)?,
                        last_attempted_sync_at: row.get(2)?,
                        reference_areas_synced_at: row.get(3)?,
                    })
                },
            )
            .map_err(fail)
    }

    pub fn list_areas(&self) -> Result<Vec<AreaRow>, StoreError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT id, name, server_updated_at, local_updated_at
                 FROM reference_areas ORDER BY name, id",
            )
            .map_err(fail)?;
        let rows = statement
            .query_map([], |row| {
                Ok(AreaRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    server_updated_at: row.get(2)?,
                    local_updated_at: row.get(3)?,
                })
            })
            .map_err(fail)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(fail)
    }

    /// Replaces the area catalog only after the full list has been validated.
    /// The delete and inserts commit together. A failed validation does not open that transaction.
    pub fn replace_areas(&mut self, areas: &[AreaInput]) -> Result<(), StoreError> {
        let cleaned = validate_areas(areas)?;
        let now = utc_now();
        let tx = self.conn.transaction().map_err(fail)?;
        tx.execute("DELETE FROM reference_areas", []).map_err(fail)?;
        for area in &cleaned {
            tx.execute(
                "INSERT INTO reference_areas (id, name, server_updated_at, local_updated_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![area.id, area.name, area.server_updated_at, now],
            )
            .map_err(fail)?;
        }
        tx.execute(
            "UPDATE sync_state SET reference_areas_synced_at = ?1 WHERE id = 1",
            params![now],
        )
        .map_err(fail)?;
        tx.commit().map_err(fail)?;
        Ok(())
    }

    pub fn note_sync_cycle(&mut self, phase: &str) -> Result<LocalStatus, StoreError> {
        let now = utc_now();
        let pending = self.pending_count()?;
        let resting = if pending > 0 { "PENDING" } else { "IDLE" };
        let (state, mark_success) = match phase {
            "start" => ("SYNCING", false),
            "succeeded" => (resting, true),
            "stopped" => (resting, false),
            _ => return Err(StoreError::InvalidPhase),
        };
        if mark_success {
            self.conn
                .execute(
                    "UPDATE sync_state
                     SET last_attempted_sync_at = ?1,
                         last_successful_sync_at = ?1,
                         current_sync_state = ?2
                     WHERE id = 1",
                    params![now, state],
                )
                .map_err(fail)?;
        } else {
            self.conn
                .execute(
                    "UPDATE sync_state
                     SET last_attempted_sync_at = ?1,
                         current_sync_state = ?2
                     WHERE id = 1",
                    params![now, state],
                )
                .map_err(fail)?;
        }
        self.status()
    }

    /// Saves a permit change, its domain event, and the outbox row in one transaction.
    /// The commit is the local save. Nothing here talks to the network.
    #[allow(dead_code)]
    pub fn record_local_change(
        &mut self,
        permit: &LocalPermitChange,
        event: &LocalEventChange,
        outbox: &OutboxChange,
    ) -> Result<(), StoreError> {
        validate_change(permit, event, outbox)?;
        let now = utc_now();
        let tx = self.conn.transaction().map_err(fail)?;
        tx.execute(
            "INSERT INTO local_permits (
                id, permit_number, permit_type, status, area_id, equipment_id, work_order,
                job_description, created_by, created_at, updated_at, planned_start, expires_at,
                current_revision, sync_state
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11, ?12, ?13, 'PENDING')",
            params![
                permit.id,
                permit.permit_number,
                permit.permit_type,
                permit.status,
                permit.area_id,
                permit.equipment_id,
                permit.work_order,
                permit.job_description,
                permit.created_by,
                now,
                permit.planned_start,
                permit.expires_at,
                permit.current_revision,
            ],
        )
        .map_err(fail)?;
        tx.execute(
            "INSERT INTO local_permit_events (
                id, permit_id, permit_revision, event_type, occurred_at, recorded_at,
                user_id, device_id, payload, sync_state
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'PENDING')",
            params![
                event.id,
                event.permit_id,
                event.permit_revision,
                event.event_type,
                event.occurred_at,
                now,
                event.user_id,
                event.device_id,
                event.payload,
            ],
        )
        .map_err(fail)?;
        tx.execute(
            "INSERT INTO outbox (
                id, event_id, entity_type, entity_id, operation, created_at,
                attempt_count, last_attempt_at, status, last_error_code
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, NULL, 'PENDING', NULL)",
            params![outbox.id, outbox.event_id, outbox.entity_type, outbox.entity_id, outbox.operation, now],
        )
        .map_err(fail)?;
        tx.execute("UPDATE sync_state SET current_sync_state = 'PENDING' WHERE id = 1", [])
            .map_err(fail)?;
        tx.commit().map_err(fail)?;
        Ok(())
    }

    fn pending_count(&self) -> Result<i64, StoreError> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM outbox WHERE status != 'ACKNOWLEDGED'",
                [],
                |row| row.get(0),
            )
            .map_err(fail)
    }
}

fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
    let current = current_version(conn)?;
    if current >= 1 {
        return Ok(());
    }
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(MIGRATION_1)?;
    tx.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?1)",
        params![utc_now()],
    )?;
    tx.commit()?;
    Ok(())
}

fn current_version(conn: &Connection) -> Result<i64, rusqlite::Error> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
        [],
        |row| row.get(0),
    )?;
    if exists == 0 {
        return Ok(0);
    }
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )
}

fn validate_areas(areas: &[AreaInput]) -> Result<Vec<AreaInput>, StoreError> {
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    let mut cleaned = Vec::with_capacity(areas.len());
    for area in areas {
        let name = area.name.trim();
        if !is_uuid(&area.id) || name.is_empty() || name.chars().count() > AREA_NAME_MAX {
            return Err(StoreError::InvalidCatalog);
        }
        if !ids.insert(area.id.to_ascii_lowercase()) || !names.insert(name.to_string()) {
            return Err(StoreError::InvalidCatalog);
        }
        cleaned.push(AreaInput {
            id: area.id.clone(),
            name: name.to_string(),
            server_updated_at: area.server_updated_at.clone(),
        });
    }
    Ok(cleaned)
}

#[allow(dead_code)]
fn validate_change(permit: &LocalPermitChange, event: &LocalEventChange, outbox: &OutboxChange) -> Result<(), StoreError> {
    if !is_uuid(&permit.id) || !is_uuid(&event.id) || !is_uuid(&outbox.id) {
        return Err(StoreError::InvalidChange);
    }
    if permit.permit_type.trim().is_empty() || permit.status.trim().is_empty() || event.event_type.trim().is_empty() {
        return Err(StoreError::InvalidChange);
    }
    if outbox.entity_type.trim().is_empty() || outbox.operation.trim().is_empty() {
        return Err(StoreError::InvalidChange);
    }
    if event.permit_id != permit.id || event.permit_revision != permit.current_revision {
        return Err(StoreError::InvalidChange);
    }
    if outbox.event_id != event.id || outbox.entity_id != permit.id {
        return Err(StoreError::InvalidChange);
    }
    if permit.current_revision < 1 {
        return Err(StoreError::InvalidChange);
    }
    for optional in [&permit.area_id, &permit.equipment_id] {
        if let Some(id) = optional {
            if !is_uuid(id) {
                return Err(StoreError::InvalidChange);
            }
        }
    }
    Ok(())
}

fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    let groups = [8usize, 4, 4, 4, 12];
    let mut index = 0;
    for (group, size) in groups.iter().enumerate() {
        if group > 0 {
            if bytes.get(index) != Some(&b'-') {
                return false;
            }
            index += 1;
        }
        for _ in 0..*size {
            let Some(byte) = bytes.get(index) else {
                return false;
            };
            if !byte.is_ascii_hexdigit() {
                return false;
            }
            index += 1;
        }
    }
    let version = bytes[14];
    let variant = bytes[19];
    (b'1'..=b'8').contains(&version) && matches!(variant, b'8' | b'9' | b'a' | b'b' | b'A' | b'B')
}

fn utc_now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn fail(err: impl std::fmt::Display) -> StoreError {
    log::error!("local store failure: {err}");
    StoreError::Unavailable
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_store() -> (tempfile::TempDir, LocalDatabase) {
        let dir = tempfile::tempdir().expect("temp dir");
        let database = LocalDatabase::open(dir.path().join(DATABASE_FILE_NAME)).expect("open");
        (dir, database)
    }

    fn area(id: &str, name: &str) -> AreaInput {
        AreaInput {
            id: id.to_string(),
            name: name.to_string(),
            server_updated_at: None,
        }
    }

    fn change(suffix: &str) -> (LocalPermitChange, LocalEventChange, OutboxChange) {
        let permit_id = format!("11111111-1111-4111-8111-{suffix}");
        let event_id = format!("22222222-2222-4222-8222-{suffix}");
        let outbox_id = format!("33333333-3333-4333-8333-{suffix}");
        let permit = LocalPermitChange {
            id: permit_id.clone(),
            permit_number: None,
            permit_type: "GENERAL_WORK".to_string(),
            status: "DRAFT".to_string(),
            area_id: Some("0b6d1a22-1111-4a1b-9c1d-111111111111".to_string()),
            equipment_id: None,
            work_order: Some("WO-10".to_string()),
            job_description: "Pump seal".to_string(),
            created_by: None,
            planned_start: None,
            expires_at: None,
            current_revision: 1,
        };
        let event = LocalEventChange {
            id: event_id.clone(),
            permit_id,
            permit_revision: 1,
            event_type: "DRAFT_RECORDED".to_string(),
            occurred_at: "2026-10-22T16:00:00Z".to_string(),
            user_id: None,
            device_id: None,
            payload: None,
        };
        let outbox = OutboxChange {
            id: outbox_id,
            event_id,
            entity_type: "permit".to_string(),
            entity_id: permit.id.clone(),
            operation: "upsert".to_string(),
        };
        (permit, event, outbox)
    }

    #[test]
    fn fresh_database_applies_initial_migration() {
        let (_dir, database) = temp_store();
        assert_eq!(database.schema_version().unwrap(), 1);
        let migrations: i64 = database
            .conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(migrations, 1);
        let status = database.status().unwrap();
        assert_eq!(status.sync_state, "IDLE");
        assert_eq!(status.pending_count, 0);
        assert_eq!(status.last_successful_sync_at, None);
        assert_eq!(status.reference_areas_synced_at, None);
        assert!(database.list_areas().unwrap().is_empty());
    }

    #[test]
    fn reopening_does_not_reapply_the_migration() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DATABASE_FILE_NAME);
        LocalDatabase::open(&path).unwrap();
        let database = LocalDatabase::open(&path).unwrap();
        assert_eq!(database.schema_version().unwrap(), 1);
        let migrations: i64 = database
            .conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(migrations, 1);
    }

    #[test]
    fn area_refresh_preserves_server_uuid_and_reopens() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DATABASE_FILE_NAME);
        let id = "0b6d1a22-1111-4a1b-9c1d-111111111111";
        {
            let mut database = LocalDatabase::open(&path).unwrap();
            database.replace_areas(&[area(id, "  Unit 1  ")]).unwrap();
        }
        let database = LocalDatabase::open(&path).unwrap();
        let areas = database.list_areas().unwrap();
        assert_eq!(areas.len(), 1);
        assert_eq!(areas[0].id, id);
        assert_eq!(areas[0].name, "Unit 1");
        assert!(database.status().unwrap().reference_areas_synced_at.is_some());
    }

    #[test]
    fn invalid_refresh_keeps_the_previous_catalog() {
        let (_dir, mut database) = temp_store();
        let kept = "0b6d1a22-1111-4a1b-9c1d-111111111111";
        database.replace_areas(&[area(kept, "Unit 1")]).unwrap();
        let synced = database.status().unwrap().reference_areas_synced_at;
        let rejected = database.replace_areas(&[
            area(kept, "Unit 1"),
            area("not-a-uuid", "Unit 2"),
        ]);
        assert!(matches!(rejected, Err(StoreError::InvalidCatalog)));
        let areas = database.list_areas().unwrap();
        assert_eq!(areas.len(), 1);
        assert_eq!(areas[0].id, kept);
        assert_eq!(database.status().unwrap().reference_areas_synced_at, synced);
    }

    #[test]
    fn successful_refresh_replaces_the_whole_catalog() {
        let (_dir, mut database) = temp_store();
        database
            .replace_areas(&[
                area("0b6d1a22-1111-4a1b-9c1d-111111111111", "Unit 1"),
                area("0b6d1a22-2222-4a1b-9c1d-222222222222", "Unit 2"),
            ])
            .unwrap();
        database
            .replace_areas(&[area("0b6d1a22-3333-4a1b-9c1d-333333333333", "Unit 3")])
            .unwrap();
        let areas = database.list_areas().unwrap();
        assert_eq!(areas.len(), 1);
        assert_eq!(areas[0].id, "0b6d1a22-3333-4a1b-9c1d-333333333333");
    }

    #[test]
    fn validated_empty_catalog_is_distinct_from_never_synced() {
        let (_dir, mut database) = temp_store();
        assert!(database.status().unwrap().reference_areas_synced_at.is_none());
        database.replace_areas(&[]).unwrap();
        assert!(database.list_areas().unwrap().is_empty());
        assert!(database.status().unwrap().reference_areas_synced_at.is_some());
    }

    #[test]
    fn outbox_and_sync_state_survive_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DATABASE_FILE_NAME);
        {
            let mut database = LocalDatabase::open(&path).unwrap();
            let (permit, event, outbox) = change("111111111111");
            database.record_local_change(&permit, &event, &outbox).unwrap();
            let syncing = database.note_sync_cycle("start").unwrap();
            assert_eq!(syncing.sync_state, "SYNCING");
            assert!(syncing.last_attempted_sync_at.is_some());
            assert!(syncing.last_successful_sync_at.is_none());
            let stopped = database.note_sync_cycle("stopped").unwrap();
            assert_eq!(stopped.sync_state, "PENDING");
            assert_eq!(stopped.pending_count, 1);
            assert!(stopped.last_successful_sync_at.is_none());
        }
        let database = LocalDatabase::open(&path).unwrap();
        let status = database.status().unwrap();
        assert_eq!(status.pending_count, 1);
        assert_eq!(status.sync_state, "PENDING");
        assert!(status.last_attempted_sync_at.is_some());
        assert!(status.last_successful_sync_at.is_none());
        let outbox_status: String = database
            .conn
            .query_row("SELECT status FROM outbox", [], |row| row.get(0))
            .unwrap();
        assert_eq!(outbox_status, "PENDING");
    }

    #[test]
    fn failed_local_change_does_not_leave_a_partial_save() {
        let (_dir, mut database) = temp_store();
        let (permit, event, outbox) = change("111111111111");
        database.record_local_change(&permit, &event, &outbox).unwrap();
        let (second_permit, mut second_event, mut second_outbox) = change("222222222222");
        second_outbox.id = outbox.id;
        second_event.permit_id = second_permit.id.clone();
        second_outbox.event_id = second_event.id.clone();
        second_outbox.entity_id = second_permit.id.clone();
        let failed = database.record_local_change(&second_permit, &second_event, &second_outbox);
        assert!(failed.is_err());
        let permits: i64 = database
            .conn
            .query_row(
                "SELECT COUNT(*) FROM local_permits WHERE id = ?1",
                params![second_permit.id],
                |row| row.get(0),
            )
            .unwrap();
        let events: i64 = database
            .conn
            .query_row(
                "SELECT COUNT(*) FROM local_permit_events WHERE id = ?1",
                params![second_event.id],
                |row| row.get(0),
            )
            .unwrap();
        let outbox_rows: i64 = database
            .conn
            .query_row("SELECT COUNT(*) FROM outbox", [], |row| row.get(0))
            .unwrap();
        assert_eq!(permits, 0);
        assert_eq!(events, 0);
        assert_eq!(outbox_rows, 1);
        assert_eq!(database.status().unwrap().sync_state, "PENDING");
    }

    #[test]
    fn successful_cycle_records_success_without_dropping_pending_work() {
        let (_dir, mut database) = temp_store();
        let (permit, event, outbox) = change("111111111111");
        database.record_local_change(&permit, &event, &outbox).unwrap();
        database.note_sync_cycle("start").unwrap();
        let succeeded = database.note_sync_cycle("succeeded").unwrap();
        assert_eq!(succeeded.pending_count, 1);
        assert_eq!(succeeded.sync_state, "PENDING");
        assert!(succeeded.last_successful_sync_at.is_some());
    }

    #[test]
    fn idle_cycle_with_an_empty_outbox_does_not_invent_pending_work() {
        let (_dir, mut database) = temp_store();
        database.note_sync_cycle("start").unwrap();
        let succeeded = database.note_sync_cycle("succeeded").unwrap();
        assert_eq!(succeeded.pending_count, 0);
        assert_eq!(succeeded.sync_state, "IDLE");
        assert!(succeeded.last_successful_sync_at.is_some());
    }
}
