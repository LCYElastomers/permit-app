use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

const MIGRATION_1: &str = include_str!("migrations/001_initial.sql");
const MIGRATION_2: &str = include_str!("migrations/002_general_work.sql");
const MIGRATION_3: &str = include_str!("migrations/003_reference_catalog.sql");
const AREA_NAME_MAX: usize = 120;
const TEXT_MAX: usize = 200;
const DESCRIPTION_MAX: usize = 4000;
const WORK_ORDER_MAX: usize = 80;

pub const DATABASE_FILE_NAME: &str = "permit-control.sqlite";

#[derive(Debug)]
pub enum StoreError {
    Unavailable,
    InvalidCatalog,
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
pub struct CatalogInput {
    pub id: String,
    pub code: String,
    pub name: String,
    pub enabled: bool,
    pub payload: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogRow {
    pub id: String,
    pub code: String,
    pub name: String,
    pub enabled: bool,
    pub payload: String,
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
    pub last_plant_contact_at: Option<String>,
    pub last_reference_sync_at: Option<String>,
    pub last_permit_sync_at: Option<String>,
    pub last_attempted_sync_at: Option<String>,
    pub reference_areas_synced_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralWorkDraftInput {
    pub id: String,
    pub event_id: String,
    pub outbox_id: String,
    #[serde(default)]
    pub area_id: Option<String>,
    pub area_name: String,
    pub equipment_tag: String,
    pub work_order: String,
    pub job_description: String,
    pub company_type: String,
    pub company_name: String,
    pub requester: String,
    pub craft: String,
    #[serde(default = "default_permit_type")]
    pub permit_type: String,
    #[serde(default)]
    pub planned_start: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
    pub working_state: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftRecord {
    pub id: String,
    pub permit_number: Option<String>,
    pub permit_type: String,
    pub status: String,
    pub sync_state: String,
    pub area_id: Option<String>,
    pub area_name: String,
    pub equipment_tag: String,
    pub work_order: String,
    pub job_description: String,
    pub company_type: String,
    pub company_name: String,
    pub requester: String,
    pub craft: String,
    pub planned_start: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub current_revision: i64,
    pub working_state: serde_json::Value,
    pub outbox_status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushablePermitCreate {
    pub outbox_id: String,
    pub event_id: String,
    pub occurred_at: String,
    pub permit_revision: i64,
    pub draft: DraftRecord,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushablePermitSubmission {
    pub outbox_id: String,
    pub event_id: String,
    pub permit_id: String,
    pub occurred_at: String,
    pub permit_revision: i64,
    pub user_id: Option<String>,
    pub device_id: Option<String>,
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
                "SELECT current_sync_state, last_plant_contact_at, last_reference_sync_at, last_permit_sync_at,
                        last_attempted_sync_at, reference_areas_synced_at
                 FROM sync_state WHERE id = 1",
                [],
                |row| {
                    Ok(LocalStatus {
                        pending_count,
                        sync_state: row.get(0)?,
                        last_plant_contact_at: row.get(1)?,
                        last_reference_sync_at: row.get(2)?,
                        last_permit_sync_at: row.get(3)?,
                        last_attempted_sync_at: row.get(4)?,
                        reference_areas_synced_at: row.get(5)?,
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
            "UPDATE sync_state
             SET reference_areas_synced_at = ?1, last_reference_sync_at = ?1
             WHERE id = 1",
            params![now],
        )
        .map_err(fail)?;
        tx.commit().map_err(fail)?;
        Ok(())
    }

    pub fn list_catalog(&self, catalog: &str) -> Result<Vec<CatalogRow>, StoreError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT id, code, name, enabled, payload FROM reference_catalog WHERE catalog = ?1 ORDER BY name, id",
            )
            .map_err(fail)?;
        let rows = statement
            .query_map(params![catalog], |row| {
                Ok(CatalogRow {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    name: row.get(2)?,
                    enabled: row.get::<_, i64>(3)? == 1,
                    payload: row.get(4)?,
                })
            })
            .map_err(fail)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(fail)
    }

    /// Replaces one catalog only after every row is valid. A rejected list leaves the previous rows.
    pub fn replace_catalog(&mut self, catalog: &str, rows: &[CatalogInput]) -> Result<(), StoreError> {
        if !catalog_name(catalog) {
            return Err(StoreError::InvalidCatalog);
        }
        let cleaned = validate_catalog(rows)?;
        let tx = self.conn.transaction().map_err(fail)?;
        tx.execute("DELETE FROM reference_catalog WHERE catalog = ?1", params![catalog]).map_err(fail)?;
        for row in &cleaned {
            tx.execute(
                "INSERT INTO reference_catalog (catalog, id, code, name, enabled, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![catalog, row.id, row.code, row.name, if row.enabled { 1 } else { 0 }, row.payload],
            )
            .map_err(fail)?;
        }
        tx.commit().map_err(fail)?;
        Ok(())
    }

    pub fn note_sync_cycle(&mut self, phase: &str) -> Result<LocalStatus, StoreError> {
        let now = utc_now();
        let retrying = self.outbox_status_count("PENDING")?;
        let attention = self.outbox_status_count("ATTENTION")?;
        let resting = if retrying > 0 {
            "PENDING"
        } else if attention > 0 {
            "REQUIRES_ATTENTION"
        } else {
            "IDLE"
        };
        let state = match phase {
            "start" => "SYNCING",
            "stopped" => resting,
            _ => return Err(StoreError::InvalidPhase),
        };
        self.conn
            .execute(
                "UPDATE sync_state
                 SET last_attempted_sync_at = ?1,
                     current_sync_state = ?2
                 WHERE id = 1",
                params![now, state],
            )
            .map_err(fail)?;
        self.status()
    }

    /// Records that the API process answered. This is not a permit sync and not a reference sync.
    pub fn note_plant_contact(&mut self) -> Result<LocalStatus, StoreError> {
        self.conn
            .execute(
                "UPDATE sync_state SET last_plant_contact_at = ?1 WHERE id = 1",
                params![utc_now()],
            )
            .map_err(fail)?;
        self.status()
    }

    pub fn list_drafts(&self) -> Result<Vec<DraftRecord>, StoreError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT id, permit_number, permit_type, status, sync_state, area_id, area_name, equipment_tag,
                        work_order, job_description, company_type, company_name, requester, craft,
                        planned_start, expires_at, created_at, updated_at, current_revision, working_state,
                        COALESCE(
                            (SELECT status FROM outbox WHERE entity_id = local_permits.id AND status != 'ACKNOWLEDGED' ORDER BY created_at DESC LIMIT 1),
                            (SELECT status FROM outbox WHERE entity_id = local_permits.id AND operation = 'create' ORDER BY created_at DESC LIMIT 1),
                            ''
                        )
                 FROM local_permits
                 ORDER BY updated_at DESC, id",
            )
            .map_err(fail)?;
        let rows = statement
            .query_map([], draft_from_row)
            .map_err(fail)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(fail)?;
        Ok(rows)
    }

    /// Creates or updates a General Work draft on this device.
    /// The first save writes the permit, PERMIT_CREATED, and a PENDING outbox row in one transaction.
    /// A later save updates the permit row only. Nothing here contacts the network or acknowledges the outbox.
    pub fn save_general_work_draft(&mut self, draft: GeneralWorkDraftInput) -> Result<DraftRecord, StoreError> {
        let prepared = prepare_general_work(draft)?;
        let exists = self.permit_exists(&prepared.id)?;
        if exists {
            self.update_general_work(&prepared)?;
        } else {
            self.create_general_work(&prepared)?;
        }
        self.read_draft(&prepared.id)
    }

    /// Moves a saved draft to PENDING_REVIEW on this device and queues PERMIT_SUBMITTED.
    /// The commit does not contact the server and does not authorize work.
    pub fn submit_for_review(
        &mut self,
        id: &str,
        event_id: &str,
        outbox_id: &str,
        user_id: Option<&str>,
    ) -> Result<DraftRecord, StoreError> {
        if !is_uuid(id) || !is_uuid(event_id) || !is_uuid(outbox_id) || event_id == outbox_id {
            return Err(StoreError::InvalidChange);
        }
        let user = match user_id {
            Some(value) if !value.is_empty() => {
                if !is_uuid(value) {
                    return Err(StoreError::InvalidChange);
                }
                Some(value)
            }
            _ => None,
        };
        let now = utc_now();
        let tx = self.conn.transaction().map_err(fail)?;
        let updated = tx
            .execute(
                "UPDATE local_permits
                 SET status = 'PENDING_REVIEW', sync_state = 'PENDING', updated_at = ?1
                 WHERE id = ?2 AND status = 'DRAFT'",
                params![now, id],
            )
            .map_err(fail)?;
        if updated != 1 {
            return Err(StoreError::InvalidChange);
        }
        tx.execute(
            "INSERT INTO local_permit_events (
                id, permit_id, permit_revision, event_type, occurred_at, recorded_at,
                user_id, device_id, payload, sync_state
             ) VALUES (?1, ?2, 1, 'PERMIT_SUBMITTED', ?3, ?3, ?4, NULL, NULL, 'PENDING')",
            params![event_id, id, now, user],
        )
        .map_err(fail)?;
        tx.execute(
            "INSERT INTO outbox (
                id, event_id, entity_type, entity_id, operation, created_at,
                attempt_count, last_attempt_at, status, last_error_code
             ) VALUES (?1, ?2, 'permit', ?3, 'submit', ?4, 0, NULL, 'PENDING', NULL)",
            params![outbox_id, event_id, id, now],
        )
        .map_err(fail)?;
        tx.execute("UPDATE sync_state SET current_sync_state = 'PENDING' WHERE id = 1", [])
            .map_err(fail)?;
        tx.commit().map_err(fail)?;
        self.read_draft(id)
    }

    fn permit_exists(&self, id: &str) -> Result<bool, StoreError> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM local_permits WHERE id = ?1", params![id], |row| row.get(0))
            .map_err(fail)?;
        Ok(count > 0)
    }

    fn create_general_work(&mut self, draft: &PreparedDraft) -> Result<(), StoreError> {
        if !is_uuid(&draft.event_id) || !is_uuid(&draft.outbox_id) || draft.event_id == draft.outbox_id {
            return Err(StoreError::InvalidChange);
        }
        let now = utc_now();
        let tx = self.conn.transaction().map_err(fail)?;
        tx.execute(
            "INSERT INTO local_permits (
                id, permit_number, permit_type, status, area_id, equipment_id, work_order,
                job_description, created_by, created_at, updated_at, planned_start, expires_at,
                current_revision, sync_state, area_name, equipment_tag, company_type, company_name,
                requester, craft, working_state
             ) VALUES (
                ?1, NULL, ?15, 'DRAFT', ?2, NULL, ?3,
                ?4, NULL, ?5, ?5, ?6, ?7,
                1, 'PENDING', ?8, ?9, ?10, ?11,
                ?12, ?13, ?14
             )",
            params![
                draft.id,
                draft.area_id,
                draft.work_order,
                draft.job_description,
                now,
                draft.planned_start,
                draft.expires_at,
                draft.area_name,
                draft.equipment_tag,
                draft.company_type,
                draft.company_name,
                draft.requester,
                draft.craft,
                draft.working_state,
                draft.permit_type,
            ],
        )
        .map_err(fail)?;
        tx.execute(
            "INSERT INTO local_permit_events (
                id, permit_id, permit_revision, event_type, occurred_at, recorded_at,
                user_id, device_id, payload, sync_state
             ) VALUES (?1, ?2, 1, 'PERMIT_CREATED', ?3, ?3, NULL, NULL, NULL, 'PENDING')",
            params![draft.event_id, draft.id, now],
        )
        .map_err(fail)?;
        tx.execute(
            "INSERT INTO outbox (
                id, event_id, entity_type, entity_id, operation, created_at,
                attempt_count, last_attempt_at, status, last_error_code
             ) VALUES (?1, ?2, 'permit', ?3, 'create', ?4, 0, NULL, 'PENDING', NULL)",
            params![draft.outbox_id, draft.event_id, draft.id, now],
        )
        .map_err(fail)?;
        tx.execute("UPDATE sync_state SET current_sync_state = 'PENDING' WHERE id = 1", [])
            .map_err(fail)?;
        tx.commit().map_err(fail)?;
        Ok(())
    }

    fn update_general_work(&mut self, draft: &PreparedDraft) -> Result<(), StoreError> {
        let changed = self
            .conn
            .execute(
                "UPDATE local_permits
                 SET area_id = ?1, area_name = ?2, equipment_tag = ?3, work_order = ?4,
                     job_description = ?5, company_type = ?6, company_name = ?7, requester = ?8,
                     craft = ?9, planned_start = ?10, expires_at = ?11, working_state = ?12,
                     updated_at = ?13, sync_state = 'PENDING'
                 WHERE id = ?14 AND status IN ('DRAFT', 'PENDING_REVIEW')",
                params![
                    draft.area_id,
                    draft.area_name,
                    draft.equipment_tag,
                    draft.work_order,
                    draft.job_description,
                    draft.company_type,
                    draft.company_name,
                    draft.requester,
                    draft.craft,
                    draft.planned_start,
                    draft.expires_at,
                    draft.working_state,
                    utc_now(),
                    draft.id,
                ],
            )
            .map_err(fail)?;
        if changed != 1 {
            return Err(StoreError::InvalidChange);
        }
        Ok(())
    }

    fn read_draft(&self, id: &str) -> Result<DraftRecord, StoreError> {
        self.conn
            .query_row(
                "SELECT id, permit_number, permit_type, status, sync_state, area_id, area_name, equipment_tag,
                        work_order, job_description, company_type, company_name, requester, craft,
                        planned_start, expires_at, created_at, updated_at, current_revision, working_state,
                        COALESCE(
                            (SELECT status FROM outbox WHERE entity_id = local_permits.id AND status != 'ACKNOWLEDGED' ORDER BY created_at DESC LIMIT 1),
                            (SELECT status FROM outbox WHERE entity_id = local_permits.id AND operation = 'create' ORDER BY created_at DESC LIMIT 1),
                            ''
                        )
                 FROM local_permits WHERE id = ?1",
                params![id],
                draft_from_row,
            )
            .map_err(fail)
    }

    pub fn list_pushable_permit_creates(&self) -> Result<Vec<PushablePermitCreate>, StoreError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT outbox.id, outbox.event_id, outbox.entity_id, events.occurred_at, events.permit_revision
                 FROM outbox
                 JOIN local_permit_events AS events ON events.id = outbox.event_id
                 JOIN local_permits AS permits ON permits.id = outbox.entity_id
                 WHERE outbox.status = 'PENDING'
                   AND outbox.operation = 'create'
                   AND events.event_type = 'PERMIT_CREATED'
                   AND permits.status IN ('DRAFT', 'PENDING_REVIEW')
                 ORDER BY outbox.created_at, outbox.id",
            )
            .map_err(fail)?;
        let keys = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            })
            .map_err(fail)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(fail)?;
        drop(statement);
        let mut items = Vec::with_capacity(keys.len());
        for (outbox_id, event_id, permit_id, occurred_at, permit_revision) in keys {
            items.push(PushablePermitCreate {
                outbox_id,
                event_id,
                occurred_at,
                permit_revision,
                draft: self.read_draft(&permit_id)?,
            });
        }
        Ok(items)
    }

    /// Submissions wait until the permit number exists, so creation is acknowledged first.
    pub fn list_pushable_permit_submissions(&self) -> Result<Vec<PushablePermitSubmission>, StoreError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT outbox.id, outbox.event_id, outbox.entity_id, events.occurred_at, events.permit_revision,
                        events.user_id, events.device_id
                 FROM outbox
                 JOIN local_permit_events AS events ON events.id = outbox.event_id
                 JOIN local_permits AS permits ON permits.id = outbox.entity_id
                 WHERE outbox.status = 'PENDING'
                   AND outbox.operation = 'submit'
                   AND events.event_type = 'PERMIT_SUBMITTED'
                   AND permits.status = 'PENDING_REVIEW'
                   AND permits.permit_number IS NOT NULL
                   AND permits.permit_number != ''
                 ORDER BY outbox.created_at, outbox.id",
            )
            .map_err(fail)?;
        let items = statement
            .query_map([], |row| {
                Ok(PushablePermitSubmission {
                    outbox_id: row.get(0)?,
                    event_id: row.get(1)?,
                    permit_id: row.get(2)?,
                    occurred_at: row.get(3)?,
                    permit_revision: row.get(4)?,
                    user_id: row.get(5)?,
                    device_id: row.get(6)?,
                })
            })
            .map_err(fail)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(fail)?;
        Ok(items)
    }

    /// Records a valid server acknowledgement. The local lifecycle status is left unchanged.
    pub fn acknowledge_permit_created(
        &mut self,
        outbox_id: &str,
        event_id: &str,
        permit_id: &str,
        permit_number: &str,
    ) -> Result<DraftRecord, StoreError> {
        if !permit_number_ok(permit_number) {
            return Err(StoreError::InvalidChange);
        }
        let now = utc_now();
        let tx = self.conn.transaction().map_err(fail)?;
        let already: Option<String> = tx
            .query_row(
                "SELECT permits.permit_number
                 FROM outbox
                 JOIN local_permits AS permits ON permits.id = outbox.entity_id
                 WHERE outbox.id = ?1 AND outbox.event_id = ?2 AND outbox.entity_id = ?3
                   AND outbox.status = 'ACKNOWLEDGED' AND outbox.operation = 'create'",
                params![outbox_id, event_id, permit_id],
                |row| row.get(0),
            )
            .ok();
        if let Some(existing) = already {
            if existing == permit_number {
                tx.commit().map_err(fail)?;
                return self.read_draft(permit_id);
            }
            return Err(StoreError::InvalidChange);
        }
        let matched: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM outbox
                 WHERE id = ?1 AND event_id = ?2 AND entity_id = ?3 AND status = 'PENDING' AND operation = 'create'",
                params![outbox_id, event_id, permit_id],
                |row| row.get(0),
            )
            .map_err(fail)?;
        if matched != 1 {
            return Err(StoreError::InvalidChange);
        }
        let updated = tx
            .execute(
                "UPDATE local_permits
                 SET permit_number = ?1, sync_state = 'SYNCHRONIZED', updated_at = ?2
                 WHERE id = ?3 AND status IN ('DRAFT', 'PENDING_REVIEW')",
                params![permit_number, now, permit_id],
            )
            .map_err(fail)?;
        if updated != 1 {
            return Err(StoreError::InvalidChange);
        }
        tx.execute(
            "UPDATE local_permit_events SET sync_state = 'ACKNOWLEDGED' WHERE id = ?1 AND permit_id = ?2",
            params![event_id, permit_id],
        )
        .map_err(fail)?;
        tx.execute(
            "UPDATE outbox SET status = 'ACKNOWLEDGED', last_error_code = NULL, last_attempt_at = ?1 WHERE id = ?2",
            params![now, outbox_id],
        )
        .map_err(fail)?;
        let resting = resting_sync_state(&tx)?;
        tx.execute(
            "UPDATE sync_state SET last_permit_sync_at = ?1, current_sync_state = ?2 WHERE id = 1",
            params![now, resting],
        )
        .map_err(fail)?;
        tx.commit().map_err(fail)?;
        self.read_draft(permit_id)
    }

    /// Marks a submitted event acknowledged. The permit number and lifecycle status stay as they are.
    pub fn acknowledge_permit_submitted(
        &mut self,
        outbox_id: &str,
        event_id: &str,
        permit_id: &str,
        permit_number: &str,
    ) -> Result<DraftRecord, StoreError> {
        if !permit_number_ok(permit_number) {
            return Err(StoreError::InvalidChange);
        }
        let now = utc_now();
        let tx = self.conn.transaction().map_err(fail)?;
        let stored: Option<String> = tx
            .query_row(
                "SELECT permit_number FROM local_permits WHERE id = ?1 AND status = 'PENDING_REVIEW'",
                params![permit_id],
                |row| row.get(0),
            )
            .ok();
        if stored.as_deref() != Some(permit_number) {
            return Err(StoreError::InvalidChange);
        }
        let already: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM outbox
                 WHERE id = ?1 AND event_id = ?2 AND entity_id = ?3 AND status = 'ACKNOWLEDGED' AND operation = 'submit'",
                params![outbox_id, event_id, permit_id],
                |row| row.get(0),
            )
            .map_err(fail)?;
        if already == 1 {
            tx.commit().map_err(fail)?;
            return self.read_draft(permit_id);
        }
        let matched: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM outbox
                 WHERE id = ?1 AND event_id = ?2 AND entity_id = ?3 AND status = 'PENDING' AND operation = 'submit'",
                params![outbox_id, event_id, permit_id],
                |row| row.get(0),
            )
            .map_err(fail)?;
        if matched != 1 {
            return Err(StoreError::InvalidChange);
        }
        tx.execute(
            "UPDATE local_permit_events SET sync_state = 'ACKNOWLEDGED' WHERE id = ?1 AND permit_id = ?2 AND event_type = 'PERMIT_SUBMITTED'",
            params![event_id, permit_id],
        )
        .map_err(fail)?;
        tx.execute(
            "UPDATE outbox SET status = 'ACKNOWLEDGED', last_error_code = NULL, last_attempt_at = ?1 WHERE id = ?2",
            params![now, outbox_id],
        )
        .map_err(fail)?;
        let remaining: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM outbox WHERE entity_id = ?1 AND status != 'ACKNOWLEDGED'",
                params![permit_id],
                |row| row.get(0),
            )
            .map_err(fail)?;
        let permit_sync = if remaining == 0 { "SYNCHRONIZED" } else { "PENDING" };
        tx.execute(
            "UPDATE local_permits SET sync_state = ?1, updated_at = ?2 WHERE id = ?3",
            params![permit_sync, now, permit_id],
        )
        .map_err(fail)?;
        let resting = resting_sync_state(&tx)?;
        tx.execute(
            "UPDATE sync_state SET last_permit_sync_at = ?1, current_sync_state = ?2 WHERE id = 1",
            params![now, resting],
        )
        .map_err(fail)?;
        tx.commit().map_err(fail)?;
        self.read_draft(permit_id)
    }

    pub fn mark_outbox_attention(&mut self, outbox_id: &str, error_code: &str) -> Result<(), StoreError> {
        let code = sanitize_error_code(error_code);
        let now = utc_now();
        let tx = self.conn.transaction().map_err(fail)?;
        let updated = tx
            .execute(
                "UPDATE outbox
                 SET status = 'ATTENTION', last_error_code = ?1, last_attempt_at = ?2
                 WHERE id = ?3 AND status = 'PENDING'",
                params![code, now, outbox_id],
            )
            .map_err(fail)?;
        if updated != 1 {
            return Err(StoreError::InvalidChange);
        }
        let resting = resting_sync_state(&tx)?;
        tx.execute(
            "UPDATE sync_state SET current_sync_state = ?1, last_attempted_sync_at = ?2 WHERE id = 1",
            params![resting, now],
        )
        .map_err(fail)?;
        tx.commit().map_err(fail)?;
        Ok(())
    }

    pub fn note_push_deferred(&mut self, outbox_id: &str) -> Result<LocalStatus, StoreError> {
        let now = utc_now();
        self.conn
            .execute(
                "UPDATE outbox
                 SET attempt_count = attempt_count + 1, last_attempt_at = ?1
                 WHERE id = ?2 AND status = 'PENDING'",
                params![now, outbox_id],
            )
            .map_err(fail)?;
        self.conn
            .execute(
                "UPDATE sync_state
                 SET current_sync_state = 'BACKOFF', last_attempted_sync_at = ?1
                 WHERE id = 1",
                params![now],
            )
            .map_err(fail)?;
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

    fn outbox_status_count(&self, status: &str) -> Result<i64, StoreError> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM outbox WHERE status = ?1",
                params![status],
                |row| row.get(0),
            )
            .map_err(fail)
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

struct PreparedDraft {
    id: String,
    event_id: String,
    outbox_id: String,
    area_id: Option<String>,
    area_name: String,
    equipment_tag: String,
    work_order: String,
    job_description: String,
    company_type: String,
    company_name: String,
    requester: String,
    craft: String,
    planned_start: Option<String>,
    expires_at: Option<String>,
    working_state: String,
    permit_type: String,
}

fn prepare_general_work(draft: GeneralWorkDraftInput) -> Result<PreparedDraft, StoreError> {
    if !is_uuid(&draft.id) {
        return Err(StoreError::InvalidChange);
    }
    let area_id = match draft.area_id {
        Some(id) if !id.trim().is_empty() => {
            if !is_uuid(id.trim()) {
                return Err(StoreError::InvalidChange);
            }
            Some(id.trim().to_string())
        }
        _ => None,
    };
    let company_type = draft.company_type.trim().to_string();
    if company_type != "LCY" && company_type != "Contractor" {
        return Err(StoreError::InvalidChange);
    }
    let (working_state, permit_type) = canonical_working_state(&draft.working_state, &draft.permit_type)?;
    Ok(PreparedDraft {
        id: draft.id,
        event_id: draft.event_id,
        outbox_id: draft.outbox_id,
        area_id,
        area_name: bounded(&draft.area_name, AREA_NAME_MAX)?,
        equipment_tag: bounded(&draft.equipment_tag, TEXT_MAX)?,
        work_order: bounded(&draft.work_order, WORK_ORDER_MAX)?,
        job_description: bounded(&draft.job_description, DESCRIPTION_MAX)?,
        company_type,
        company_name: bounded(&draft.company_name, TEXT_MAX)?,
        requester: bounded(&draft.requester, TEXT_MAX)?,
        craft: bounded(&draft.craft, TEXT_MAX)?,
        planned_start: blank_to_none(draft.planned_start),
        expires_at: blank_to_none(draft.expires_at),
        working_state,
        permit_type,
    })
}

fn default_permit_type() -> String {
    "GENERAL_WORK".to_string()
}

fn permit_type_ok(value: &str) -> bool {
    matches!(
        value,
        "GENERAL_WORK" | "HOT_WORK" | "CONFINED_SPACE" | "OPENING_BLINDING" | "EXCAVATION" | "LIVE_ELECTRICAL"
    )
}

fn canonical_working_state(value: &serde_json::Value, permit_type: &str) -> Result<(String, String), StoreError> {
    let Some(object) = value.as_object() else {
        return Err(StoreError::InvalidChange);
    };
    let version = object.get("version").and_then(serde_json::Value::as_i64);
    let permit_type = if version == Some(1) {
        if permit_type != "GENERAL_WORK" {
            return Err(StoreError::InvalidChange);
        }
        let step = object.get("step").and_then(serde_json::Value::as_i64);
        if step.is_none_or(|step| !(0..=5).contains(&step)) {
            return Err(StoreError::InvalidChange);
        }
        if !object.get("hazards").is_some_and(serde_json::Value::is_array)
            || !object.get("controls").is_some_and(serde_json::Value::is_array)
            || !object.get("fields").is_some_and(serde_json::Value::is_object)
            || !object.get("names").is_some_and(serde_json::Value::is_object)
            || !object.get("signatures").is_some_and(serde_json::Value::is_object)
        {
            return Err(StoreError::InvalidChange);
        }
        "GENERAL_WORK".to_string()
    } else if version == Some(2) {
        let declared = object.get("permitType").and_then(serde_json::Value::as_str).unwrap_or("");
        if !permit_type_ok(declared) || declared != permit_type {
            return Err(StoreError::InvalidChange);
        }
        let step = object.get("workflowStep").and_then(serde_json::Value::as_i64);
        if step.is_none_or(|step| !(0..=5).contains(&step)) {
            return Err(StoreError::InvalidChange);
        }
        let Some(module_state) = object.get("moduleState").and_then(serde_json::Value::as_object) else {
            return Err(StoreError::InvalidChange);
        };
        if !module_state.get("hazards").is_some_and(serde_json::Value::is_array)
            || !module_state.get("controls").is_some_and(serde_json::Value::is_array)
            || !module_state.get("fields").is_some_and(serde_json::Value::is_object)
            || !module_state.get("names").is_some_and(serde_json::Value::is_object)
            || !module_state.get("signatures").is_some_and(serde_json::Value::is_object)
        {
            return Err(StoreError::InvalidChange);
        }
        declared.to_string()
    } else {
        return Err(StoreError::InvalidChange);
    };
    let stored = serde_json::to_string(value).map_err(|error| {
        log::error!("working state could not be stored: {error}");
        StoreError::InvalidChange
    })?;
    Ok((stored, permit_type))
}

fn bounded(value: &str, max: usize) -> Result<String, StoreError> {
    let trimmed = value.trim();
    if trimmed.chars().count() > max {
        return Err(StoreError::InvalidChange);
    }
    Ok(trimmed.to_string())
}

fn blank_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    })
}

fn resting_sync_state(conn: &Connection) -> Result<&'static str, StoreError> {
    let retrying: i64 = conn
        .query_row("SELECT COUNT(*) FROM outbox WHERE status = 'PENDING'", [], |row| row.get(0))
        .map_err(fail)?;
    let attention: i64 = conn
        .query_row("SELECT COUNT(*) FROM outbox WHERE status = 'ATTENTION'", [], |row| row.get(0))
        .map_err(fail)?;
    Ok(if retrying > 0 {
        "PENDING"
    } else if attention > 0 {
        "REQUIRES_ATTENTION"
    } else {
        "IDLE"
    })
}

fn permit_number_ok(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("PTW-") else {
        return false;
    };
    let Some((year, sequence)) = rest.split_once('-') else {
        return false;
    };
    year.len() == 4
        && year.chars().all(|character| character.is_ascii_digit())
        && sequence.len() >= 5
        && sequence.chars().all(|character| character.is_ascii_digit())
}

fn sanitize_error_code(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-')
        .take(40)
        .collect();
    if cleaned.is_empty() { "rejected".to_string() } else { cleaned }
}

fn draft_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DraftRecord> {
    let raw: String = row.get(19)?;
    let working_state = serde_json::from_str(&raw).map_err(|error| {
        log::error!("working state unreadable: {error}");
        rusqlite::Error::InvalidColumnType(19, "working_state".to_string(), rusqlite::types::Type::Text)
    })?;
    Ok(DraftRecord {
        id: row.get(0)?,
        permit_number: row.get(1)?,
        permit_type: row.get(2)?,
        status: row.get(3)?,
        sync_state: row.get(4)?,
        area_id: row.get(5)?,
        area_name: row.get(6)?,
        equipment_tag: row.get(7)?,
        work_order: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
        job_description: row.get(9)?,
        company_type: row.get(10)?,
        company_name: row.get(11)?,
        requester: row.get(12)?,
        craft: row.get(13)?,
        planned_start: row.get(14)?,
        expires_at: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
        current_revision: row.get(18)?,
        working_state,
        outbox_status: row.get(20)?,
    })
}

fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
    if current_version(conn)? < 1 {
        apply_migration(conn, 1, MIGRATION_1)?;
    }
    if current_version(conn)? < 2 {
        apply_migration(conn, 2, MIGRATION_2)?;
    }
    if current_version(conn)? < 3 {
        apply_migration(conn, 3, MIGRATION_3)?;
    }
    Ok(())
}

fn catalog_name(catalog: &str) -> bool {
    matches!(catalog, "equipment" | "contractors" | "work-types" | "hazards" | "controls" | "ppe" | "templates")
}

fn validate_catalog(rows: &[CatalogInput]) -> Result<Vec<CatalogInput>, StoreError> {
    let mut cleaned = Vec::with_capacity(rows.len());
    let mut seen = HashSet::new();
    for row in rows {
        let id = row.id.trim();
        let code = row.code.trim();
        let name = row.name.trim();
        if id.is_empty() || code.is_empty() || name.is_empty() || code.len() > 40 || name.len() > 160 || row.payload.len() > 2000 {
            return Err(StoreError::InvalidCatalog);
        }
        if !seen.insert(id.to_string()) {
            return Err(StoreError::InvalidCatalog);
        }
        cleaned.push(CatalogInput {
            id: id.to_string(),
            code: code.to_string(),
            name: name.to_string(),
            enabled: row.enabled,
            payload: row.payload.clone(),
        });
    }
    Ok(cleaned)
}

fn apply_migration(conn: &Connection, version: i64, script: &str) -> Result<(), rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(script)?;
    tx.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
        params![version, utc_now()],
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

    #[test]
    fn rejected_catalog_refresh_keeps_the_last_good_copy() {
        let (_dir, mut database) = temp_store();
        let good = CatalogInput {
            id: "eq-1".to_string(),
            code: "P-200".to_string(),
            name: "Pump".to_string(),
            enabled: true,
            payload: "{}".to_string(),
        };
        database.replace_catalog("equipment", &[good.clone()]).unwrap();
        let rejected = CatalogInput {
            id: " ".to_string(),
            code: "BAD".to_string(),
            name: "Bad".to_string(),
            enabled: true,
            payload: "{}".to_string(),
        };
        assert!(database.replace_catalog("equipment", &[rejected]).is_err());
        assert_eq!(database.list_catalog("equipment").unwrap(), vec![CatalogRow {
            id: good.id,
            code: good.code,
            name: good.name,
            enabled: true,
            payload: good.payload,
        }]);
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
        assert_eq!(database.schema_version().unwrap(), 3);
        let migrations: i64 = database
            .conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(migrations, 3);
        let catalog: i64 = database
            .conn
            .query_row("SELECT COUNT(*) FROM reference_catalog", [], |row| row.get(0))
            .unwrap();
        assert_eq!(catalog, 0);
        let status = database.status().unwrap();
        assert_eq!(status.sync_state, "IDLE");
        assert_eq!(status.pending_count, 0);
        assert_eq!(status.last_plant_contact_at, None);
        assert_eq!(status.last_reference_sync_at, None);
        assert_eq!(status.last_permit_sync_at, None);
        assert_eq!(status.reference_areas_synced_at, None);
        assert!(database.list_areas().unwrap().is_empty());
    }

    #[test]
    fn reopening_does_not_reapply_the_migration() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DATABASE_FILE_NAME);
        LocalDatabase::open(&path).unwrap();
        let database = LocalDatabase::open(&path).unwrap();
        assert_eq!(database.schema_version().unwrap(), 3);
        let migrations: i64 = database
            .conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(migrations, 3);
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
            assert!(syncing.last_permit_sync_at.is_none());
            let stopped = database.note_sync_cycle("stopped").unwrap();
            assert_eq!(stopped.sync_state, "PENDING");
            assert_eq!(stopped.pending_count, 1);
            assert!(stopped.last_permit_sync_at.is_none());
        }
        let database = LocalDatabase::open(&path).unwrap();
        let status = database.status().unwrap();
        assert_eq!(status.pending_count, 1);
        assert_eq!(status.sync_state, "PENDING");
        assert!(status.last_attempted_sync_at.is_some());
        assert!(status.last_permit_sync_at.is_none());
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
    fn finished_cycle_does_not_record_permit_sync_or_drop_pending_work() {
        let (_dir, mut database) = temp_store();
        let (permit, event, outbox) = change("111111111111");
        database.record_local_change(&permit, &event, &outbox).unwrap();
        database.note_sync_cycle("start").unwrap();
        let stopped = database.note_sync_cycle("stopped").unwrap();
        assert_eq!(stopped.pending_count, 1);
        assert_eq!(stopped.sync_state, "PENDING");
        assert!(stopped.last_permit_sync_at.is_none());
        assert!(stopped.last_reference_sync_at.is_none());
    }

    #[test]
    fn idle_cycle_with_an_empty_outbox_does_not_invent_pending_work() {
        let (_dir, mut database) = temp_store();
        database.note_sync_cycle("start").unwrap();
        let stopped = database.note_sync_cycle("stopped").unwrap();
        assert_eq!(stopped.pending_count, 0);
        assert_eq!(stopped.sync_state, "IDLE");
        assert!(stopped.last_permit_sync_at.is_none());
    }

    fn sample_draft(suffix: &str) -> GeneralWorkDraftInput {
        GeneralWorkDraftInput {
            id: format!("44444444-4444-4444-8444-{suffix}"),
            event_id: format!("55555555-5555-4555-8555-{suffix}"),
            outbox_id: format!("66666666-6666-4666-8666-{suffix}"),
            area_id: Some("0b6d1a22-1111-4a1b-9c1d-111111111111".to_string()),
            area_name: "Unit 2".to_string(),
            equipment_tag: "P-210".to_string(),
            work_order: "WO-104700".to_string(),
            job_description: "Gauge glass inspection".to_string(),
            company_type: "Contractor".to_string(),
            company_name: "Gulf Industrial Services".to_string(),
            requester: "Elena Voss".to_string(),
            craft: "Jordan Peck".to_string(),
            planned_start: Some("15:00".to_string()),
            expires_at: Some("19:00".to_string()),
            permit_type: "GENERAL_WORK".to_string(),
            working_state: serde_json::json!({
                "version": 1,
                "step": 3,
                "hazards": ["slip/trip"],
                "controls": ["barricade"],
                "fields": {
                    "taskType": "Inspection",
                    "excludeOpening": "excluded",
                    "excludeHotWork": "excluded",
                    "ppe": "Gloves"
                },
                "names": { "requester": "Elena Voss" },
                "signatures": {}
            }),
        }
    }

    fn counts(database: &LocalDatabase) -> (i64, i64, i64) {
        let permits: i64 = database.conn.query_row("SELECT COUNT(*) FROM local_permits", [], |row| row.get(0)).unwrap();
        let events: i64 = database
            .conn
            .query_row("SELECT COUNT(*) FROM local_permit_events", [], |row| row.get(0))
            .unwrap();
        let outbox: i64 = database.conn.query_row("SELECT COUNT(*) FROM outbox", [], |row| row.get(0)).unwrap();
        (permits, events, outbox)
    }

    #[test]
    fn general_work_draft_is_created_locally_as_one_pending_change() {
        let (_dir, mut database) = temp_store();
        let saved = database.save_general_work_draft(sample_draft("111111111111")).unwrap();
        assert_eq!(saved.id, "44444444-4444-4444-8444-111111111111");
        assert_eq!(saved.permit_number, None);
        assert_eq!(saved.permit_type, "GENERAL_WORK");
        assert_eq!(saved.status, "DRAFT");
        assert_eq!(saved.sync_state, "PENDING");
        assert_eq!(saved.area_id.as_deref(), Some("0b6d1a22-1111-4a1b-9c1d-111111111111"));
        assert_eq!(saved.area_name, "Unit 2");
        assert_eq!(saved.current_revision, 1);
        assert_eq!(saved.working_state["version"], 1);
        assert_eq!(saved.working_state["step"], 3);
        assert_eq!(saved.working_state["fields"]["taskType"], "Inspection");
        let (permits, events, outbox_rows) = counts(&database);
        assert_eq!((permits, events, outbox_rows), (1, 1, 1));
        let event_type: String = database
            .conn
            .query_row("SELECT event_type FROM local_permit_events", [], |row| row.get(0))
            .unwrap();
        let payload: Option<String> = database
            .conn
            .query_row("SELECT payload FROM local_permit_events", [], |row| row.get(0))
            .unwrap();
        let outbox_status: String = database.conn.query_row("SELECT status FROM outbox", [], |row| row.get(0)).unwrap();
        assert_eq!(event_type, "PERMIT_CREATED");
        assert_eq!(payload, None);
        assert_eq!(outbox_status, "PENDING");
        assert_eq!(database.status().unwrap().pending_count, 1);
        assert!(database.status().unwrap().last_permit_sync_at.is_none());
    }

    #[test]
    fn every_permit_type_saves_reopens_and_can_be_submitted_locally() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DATABASE_FILE_NAME);
        let types = [
            "GENERAL_WORK",
            "HOT_WORK",
            "CONFINED_SPACE",
            "OPENING_BLINDING",
            "EXCAVATION",
            "LIVE_ELECTRICAL",
        ];
        {
            let mut database = LocalDatabase::open(&path).unwrap();
            for (index, permit_type) in types.iter().enumerate() {
                let suffix = format!("{:012}", index + 1);
                let mut draft = sample_draft(&suffix);
                draft.permit_type = (*permit_type).to_string();
                draft.working_state = serde_json::json!({
                    "version": 2,
                    "permitType": permit_type,
                    "workflowStep": 2,
                    "moduleState": {
                        "hazards": ["heat"],
                        "controls": ["watch"],
                        "fields": { "fireWatch": "Alex Morgan", "depth": "4 ft" },
                        "names": {},
                        "signatures": {}
                    }
                });
                let saved = database.save_general_work_draft(draft).unwrap();
                assert_eq!(saved.permit_type, *permit_type);
                assert_eq!(saved.status, "DRAFT");
                assert_eq!(saved.sync_state, "PENDING");
                assert_eq!(saved.working_state["moduleState"]["fields"]["fireWatch"], "Alex Morgan");
                assert_eq!(saved.working_state["moduleState"]["fields"]["depth"], "4 ft");
            }
            assert_eq!(counts(&database), (6, 6, 6));
            assert_eq!(database.list_drafts().unwrap().len(), 6);
            let submitted = database
                .submit_for_review(
                    "44444444-4444-4444-8444-000000000002",
                    "77777777-7777-4777-8777-000000000002",
                    "88888888-8888-4888-8888-000000000002",
                    None,
                )
                .unwrap();
            assert_eq!(submitted.permit_type, "HOT_WORK");
            assert_eq!(submitted.status, "PENDING_REVIEW");
            assert_eq!(submitted.outbox_status, "PENDING");
            assert_eq!(submitted.working_state["permitType"], "HOT_WORK");
            assert_eq!(database.list_pushable_permit_creates().unwrap().len(), 6);
            assert!(database.list_pushable_permit_submissions().unwrap().is_empty());
            let submitted_events: i64 = database
                .conn
                .query_row(
                    "SELECT COUNT(*) FROM local_permit_events WHERE event_type = 'PERMIT_SUBMITTED' AND sync_state = 'PENDING'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(submitted_events, 1);
            assert_eq!(counts(&database).2, 7);
        }
        let mut database = LocalDatabase::open(&path).unwrap();
        let hot = database
            .list_drafts()
            .unwrap()
            .into_iter()
            .find(|draft| draft.permit_type == "HOT_WORK")
            .unwrap();
        assert_eq!(hot.status, "PENDING_REVIEW");
        assert_eq!(hot.outbox_status, "PENDING");
        assert_eq!(hot.working_state["moduleState"]["fields"]["depth"], "4 ft");
        let pending_submit: i64 = database
            .conn
            .query_row(
                "SELECT COUNT(*) FROM outbox WHERE operation = 'submit' AND status = 'PENDING'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(pending_submit, 1);
        let mut edited = sample_draft("000000000002");
        edited.permit_type = "HOT_WORK".to_string();
        edited.job_description = "Weld the spool".to_string();
        edited.working_state = hot.working_state.clone();
        edited.working_state["workflowStep"] = serde_json::json!(3);
        edited.event_id.clear();
        edited.outbox_id.clear();
        let saved = database.save_general_work_draft(edited).unwrap();
        assert_eq!(saved.status, "PENDING_REVIEW");
        assert_eq!(saved.job_description, "Weld the spool");
        assert_eq!(saved.working_state["workflowStep"], 3);
    }

    #[test]
    fn failed_general_work_create_rolls_back_permit_event_and_outbox() {
        let (_dir, mut database) = temp_store();
        let (permit, event, outbox) = change("111111111111");
        database.record_local_change(&permit, &event, &outbox).unwrap();
        let mut draft = sample_draft("222222222222");
        draft.event_id = event.id;
        let failed = database.save_general_work_draft(draft);
        assert!(failed.is_err());
        assert_eq!(counts(&database), (1, 1, 1));
        let created: i64 = database
            .conn
            .query_row(
                "SELECT COUNT(*) FROM local_permits WHERE id = '44444444-4444-4444-8444-222222222222'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(created, 0);
        assert_eq!(database.status().unwrap().pending_count, 1);
    }

    #[test]
    fn draft_survives_reopen_and_a_later_edit_does_not_add_an_event() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DATABASE_FILE_NAME);
        {
            let mut database = LocalDatabase::open(&path).unwrap();
            database.save_general_work_draft(sample_draft("111111111111")).unwrap();
        }
        let mut database = LocalDatabase::open(&path).unwrap();
        let listed = database.list_drafts().unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].job_description, "Gauge glass inspection");
        assert_eq!(listed[0].working_state["step"], 3);
        let mut edited = sample_draft("111111111111");
        edited.job_description = "Gauge glass and local valve".to_string();
        edited.working_state["step"] = serde_json::json!(4);
        edited.working_state["fields"]["ppe"] = serde_json::json!("Gloves, faceshield");
        edited.event_id.clear();
        edited.outbox_id.clear();
        let saved = database.save_general_work_draft(edited).unwrap();
        assert_eq!(saved.job_description, "Gauge glass and local valve");
        assert_eq!(saved.working_state["step"], 4);
        assert_eq!(saved.permit_number, None);
        assert_eq!(saved.sync_state, "PENDING");
        assert_eq!(counts(&database), (1, 1, 1));
        let outbox_status: String = database.conn.query_row("SELECT status FROM outbox", [], |row| row.get(0)).unwrap();
        assert_eq!(outbox_status, "PENDING");
    }

    #[test]
    fn area_refresh_and_plant_contact_do_not_acknowledge_a_draft() {
        let (_dir, mut database) = temp_store();
        database.save_general_work_draft(sample_draft("111111111111")).unwrap();
        database
            .replace_areas(&[area("0b6d1a22-1111-4a1b-9c1d-111111111111", "Unit 2")])
            .unwrap();
        let contacted = database.note_plant_contact().unwrap();
        database.note_sync_cycle("start").unwrap();
        let finished = database.note_sync_cycle("stopped").unwrap();
        assert!(contacted.last_plant_contact_at.is_some());
        assert!(finished.last_reference_sync_at.is_some());
        assert!(finished.last_permit_sync_at.is_none());
        assert_eq!(finished.pending_count, 1);
        let outbox_status: String = database.conn.query_row("SELECT status FROM outbox", [], |row| row.get(0)).unwrap();
        assert_eq!(outbox_status, "PENDING");
        let listed = database.list_drafts().unwrap();
        assert_eq!(listed[0].area_id.as_deref(), Some("0b6d1a22-1111-4a1b-9c1d-111111111111"));
        assert_eq!(listed[0].working_state["fields"]["excludeOpening"], "excluded");
    }

    #[test]
    fn acknowledgement_stores_the_permit_number_and_leaves_the_draft() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DATABASE_FILE_NAME);
        let outbox_id;
        let event_id;
        let permit_id;
        {
            let mut database = LocalDatabase::open(&path).unwrap();
            let saved = database.save_general_work_draft(sample_draft("111111111111")).unwrap();
            database.note_push_deferred("66666666-6666-4666-8666-111111111111").unwrap();
            let deferred = database.status().unwrap();
            assert_eq!(deferred.sync_state, "BACKOFF");
            assert!(deferred.last_permit_sync_at.is_none());
            let pushable = database.list_pushable_permit_creates().unwrap();
            assert_eq!(pushable.len(), 1);
            outbox_id = pushable[0].outbox_id.clone();
            event_id = pushable[0].event_id.clone();
            permit_id = saved.id;
            let acknowledged = database
                .acknowledge_permit_created(&outbox_id, &event_id, &permit_id, "PTW-2026-00142")
                .unwrap();
            assert_eq!(acknowledged.permit_number.as_deref(), Some("PTW-2026-00142"));
            assert_eq!(acknowledged.status, "DRAFT");
            assert_eq!(acknowledged.outbox_status, "ACKNOWLEDGED");
            assert!(database.status().unwrap().last_permit_sync_at.is_some());
            assert_eq!(database.status().unwrap().pending_count, 0);
            database
                .acknowledge_permit_created(&outbox_id, &event_id, &permit_id, "PTW-2026-00142")
                .unwrap();
            assert_eq!(database.list_drafts().unwrap()[0].permit_number.as_deref(), Some("PTW-2026-00142"));
        }
        let database = LocalDatabase::open(&path).unwrap();
        let draft = database.list_drafts().unwrap();
        assert_eq!(draft[0].permit_number.as_deref(), Some("PTW-2026-00142"));
        assert_eq!(draft[0].status, "DRAFT");
        assert!(database.list_pushable_permit_creates().unwrap().is_empty());
        assert!(database.status().unwrap().last_permit_sync_at.is_some());
    }

    #[test]
    fn submitted_permit_survives_reopen_and_acknowledges_after_the_number() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DATABASE_FILE_NAME);
        {
            let mut database = LocalDatabase::open(&path).unwrap();
            database.save_general_work_draft(sample_draft("111111111111")).unwrap();
            database
                .submit_for_review(
                    "44444444-4444-4444-8444-111111111111",
                    "77777777-7777-4777-8777-111111111111",
                    "88888888-8888-4888-8888-111111111111",
                    Some("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
                )
                .unwrap();
            assert!(database.list_pushable_permit_submissions().unwrap().is_empty());
            assert_eq!(database.status().unwrap().pending_count, 2);
        }
        let mut database = LocalDatabase::open(&path).unwrap();
        let reopened = database.list_drafts().unwrap();
        assert_eq!(reopened[0].status, "PENDING_REVIEW");
        assert_eq!(reopened[0].permit_number, None);
        assert_eq!(database.list_pushable_permit_creates().unwrap().len(), 1);
        let create = database.list_pushable_permit_creates().unwrap().remove(0);
        database
            .acknowledge_permit_created(&create.outbox_id, &create.event_id, &create.draft.id, "PTW-2026-00042")
            .unwrap();
        let submissions = database.list_pushable_permit_submissions().unwrap();
        assert_eq!(submissions.len(), 1);
        assert_eq!(submissions[0].user_id.as_deref(), Some("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
        database.note_push_deferred(&submissions[0].outbox_id).unwrap();
        assert_eq!(database.status().unwrap().sync_state, "BACKOFF");
        assert_eq!(database.list_pushable_permit_submissions().unwrap().len(), 1);
        let acked = database
            .acknowledge_permit_submitted(
                &submissions[0].outbox_id,
                &submissions[0].event_id,
                &submissions[0].permit_id,
                "PTW-2026-00042",
            )
            .unwrap();
        assert_eq!(acked.status, "PENDING_REVIEW");
        assert_eq!(acked.permit_number.as_deref(), Some("PTW-2026-00042"));
        assert_eq!(acked.outbox_status, "ACKNOWLEDGED");
        assert_eq!(database.status().unwrap().pending_count, 0);
        assert!(database.status().unwrap().last_permit_sync_at.is_some());
        assert!(database.list_pushable_permit_submissions().unwrap().is_empty());
        database
            .acknowledge_permit_submitted(
                &submissions[0].outbox_id,
                &submissions[0].event_id,
                &submissions[0].permit_id,
                "PTW-2026-00042",
            )
            .unwrap();
        assert_eq!(database.list_drafts().unwrap().len(), 1);
    }

    #[test]
    fn permanent_rejection_needs_attention_and_unsupported_work_stays_pending() {
        let (_dir, mut database) = temp_store();
        database.save_general_work_draft(sample_draft("111111111111")).unwrap();
        database
            .conn
            .execute(
                "INSERT INTO outbox (
                    id, event_id, entity_type, entity_id, operation, created_at, attempt_count, status
                 ) VALUES (
                    '77777777-7777-4777-8777-777777777777',
                    '55555555-5555-4555-8555-111111111111',
                    'permit',
                    '44444444-4444-4444-8444-111111111111',
                    'suspend',
                    '2026-10-22T18:00:00Z',
                    0,
                    'PENDING'
                 )",
                [],
            )
            .unwrap();
        database
            .mark_outbox_attention("66666666-6666-4666-8666-111111111111", "unknown-area")
            .unwrap();
        let pushable = database.list_pushable_permit_creates().unwrap();
        assert!(pushable.is_empty());
        let statuses: Vec<String> = {
            let mut statement = database
                .conn
                .prepare("SELECT operation, status FROM outbox ORDER BY operation")
                .unwrap();
            let rows = statement
                .query_map([], |row| Ok(format!("{}:{}", row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                .unwrap();
            rows.map(|row| row.unwrap()).collect()
        };
        assert_eq!(statuses, vec!["create:ATTENTION".to_string(), "suspend:PENDING".to_string()]);
        assert_eq!(database.note_sync_cycle("stopped").unwrap().sync_state, "PENDING");
        assert!(database.status().unwrap().last_permit_sync_at.is_none());
    }
}
