ALTER TABLE local_permits ADD COLUMN area_name TEXT NOT NULL DEFAULT '';
ALTER TABLE local_permits ADD COLUMN equipment_tag TEXT NOT NULL DEFAULT '';
ALTER TABLE local_permits ADD COLUMN company_type TEXT NOT NULL DEFAULT '';
ALTER TABLE local_permits ADD COLUMN company_name TEXT NOT NULL DEFAULT '';
ALTER TABLE local_permits ADD COLUMN requester TEXT NOT NULL DEFAULT '';
ALTER TABLE local_permits ADD COLUMN craft TEXT NOT NULL DEFAULT '';
ALTER TABLE local_permits ADD COLUMN working_state TEXT NOT NULL DEFAULT '{"version":1}';

ALTER TABLE sync_state ADD COLUMN last_plant_contact_at TEXT;
ALTER TABLE sync_state ADD COLUMN last_reference_sync_at TEXT;
ALTER TABLE sync_state ADD COLUMN last_permit_sync_at TEXT;

UPDATE sync_state
SET last_reference_sync_at = reference_areas_synced_at
WHERE last_reference_sync_at IS NULL
  AND reference_areas_synced_at IS NOT NULL;
