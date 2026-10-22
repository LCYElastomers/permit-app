CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE areas (
        "Id" uuid NOT NULL,
        "Name" character varying(120) NOT NULL,
        CONSTRAINT "PK_areas" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE contractors (
        "Id" uuid NOT NULL,
        "Name" character varying(160) NOT NULL,
        CONSTRAINT "PK_contractors" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE devices (
        "Id" uuid NOT NULL,
        "Name" character varying(120) NOT NULL,
        "LastSeenAt" timestamptz,
        CONSTRAINT "PK_devices" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE roles (
        "Id" uuid NOT NULL,
        "Name" character varying(80) NOT NULL,
        CONSTRAINT "PK_roles" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE sync_events (
        "Id" uuid NOT NULL,
        "DeviceId" uuid,
        "PermitId" uuid,
        "EventType" character varying(40) NOT NULL,
        "ReceivedAt" timestamptz NOT NULL,
        CONSTRAINT "PK_sync_events" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE users (
        "Id" uuid NOT NULL,
        "Username" character varying(80) NOT NULL,
        "DisplayName" character varying(160) NOT NULL,
        "Email" character varying(200) NOT NULL,
        "AuthProvider" character varying(16) NOT NULL,
        "ExternalSubjectId" character varying(200),
        "Enabled" boolean NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        CONSTRAINT "PK_users" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE equipment (
        "Id" uuid NOT NULL,
        "AreaId" uuid NOT NULL,
        "Tag" character varying(80) NOT NULL,
        "Name" character varying(160) NOT NULL,
        CONSTRAINT "PK_equipment" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_equipment_areas_AreaId" FOREIGN KEY ("AreaId") REFERENCES areas ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE user_roles (
        "UserId" uuid NOT NULL,
        "RoleId" uuid NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("UserId", "RoleId"),
        CONSTRAINT "FK_user_roles_roles_RoleId" FOREIGN KEY ("RoleId") REFERENCES roles ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permits (
        "Id" uuid NOT NULL,
        "PermitNumber" character varying(32) NOT NULL,
        "PermitType" character varying(40) NOT NULL,
        "Status" character varying(40) NOT NULL,
        "AreaId" uuid NOT NULL,
        "EquipmentId" uuid,
        "WorkOrder" character varying(40) NOT NULL,
        "JobDescription" character varying(2000) NOT NULL,
        "CompanyType" character varying(40) NOT NULL,
        "ContractorId" uuid,
        "CreatedBy" uuid NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        "UpdatedAt" timestamptz NOT NULL,
        "PlannedStart" timestamptz NOT NULL,
        "ExpiresAt" timestamptz NOT NULL,
        "ActivatedAt" timestamptz,
        "ClosedAt" timestamptz,
        "CurrentRevision" integer NOT NULL,
        CONSTRAINT "PK_permits" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permits_areas_AreaId" FOREIGN KEY ("AreaId") REFERENCES areas ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_permits_contractors_ContractorId" FOREIGN KEY ("ContractorId") REFERENCES contractors ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_permits_equipment_EquipmentId" FOREIGN KEY ("EquipmentId") REFERENCES equipment ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_permits_users_CreatedBy" FOREIGN KEY ("CreatedBy") REFERENCES users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE atmospheric_tests (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "ModuleId" uuid,
        "TestedAt" timestamptz NOT NULL,
        "OxygenPercent" numeric(5,2),
        "LelPercent" numeric(5,2),
        "CarbonMonoxidePpm" numeric(8,2),
        "TesterUserId" uuid,
        "Result" character varying(40) NOT NULL,
        "Notes" character varying(500),
        CONSTRAINT "PK_atmospheric_tests" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_atmospheric_tests_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE attachments (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "PermitRevisionId" uuid,
        "OriginalFilename" character varying(260) NOT NULL,
        "StoredFilename" character varying(80) NOT NULL,
        "StorageProvider" character varying(40) NOT NULL,
        "StorageKey" character varying(300) NOT NULL,
        "MimeType" character varying(120) NOT NULL,
        "FileSize" bigint NOT NULL,
        "Sha256" character varying(64) NOT NULL,
        "CreatedBy" uuid NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        "SupersededBy" uuid,
        CONSTRAINT "PK_attachments" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_attachments_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE isolations (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "ModuleId" uuid,
        "Plan" character varying(80) NOT NULL,
        "LockBox" character varying(80),
        "ZeroEnergyVerifiedAt" timestamptz,
        "VerifiedBy" uuid,
        CONSTRAINT "PK_isolations" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_isolations_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_approvals (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "RoleName" character varying(80) NOT NULL,
        "UserId" uuid,
        "Decision" character varying(40) NOT NULL,
        "DecidedAt" timestamptz,
        CONSTRAINT "PK_permit_approvals" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_approvals_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_closures (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "ClosedAt" timestamptz NOT NULL,
        "ClosedBy" uuid NOT NULL,
        "Notes" character varying(500),
        CONSTRAINT "PK_permit_closures" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_closures_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_controls (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "ModuleId" uuid,
        "Label" character varying(160) NOT NULL,
        CONSTRAINT "PK_permit_controls" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_controls_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_events (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "PermitRevision" integer NOT NULL,
        "EventType" character varying(40) NOT NULL,
        "OccurredAt" timestamptz NOT NULL,
        "RecordedAt" timestamptz NOT NULL,
        "UserId" uuid,
        "DeviceId" uuid,
        "Payload" jsonb,
        "SyncSource" character varying(40) NOT NULL,
        CONSTRAINT "PK_permit_events" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_events_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_extensions (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "PreviousExpiresAt" timestamptz NOT NULL,
        "NewExpiresAt" timestamptz NOT NULL,
        "ExtendedAt" timestamptz NOT NULL,
        "ExtendedBy" uuid NOT NULL,
        CONSTRAINT "PK_permit_extensions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_extensions_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_hazards (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "ModuleId" uuid,
        "Label" character varying(160) NOT NULL,
        CONSTRAINT "PK_permit_hazards" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_hazards_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_modules (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "Kind" character varying(40) NOT NULL,
        "Required" boolean NOT NULL,
        CONSTRAINT "PK_permit_modules" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_modules_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_participants (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "RoleName" character varying(80) NOT NULL,
        "UserId" uuid,
        "DisplayName" character varying(160) NOT NULL,
        CONSTRAINT "PK_permit_participants" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_participants_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_ppe (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "Label" character varying(160) NOT NULL,
        CONSTRAINT "PK_permit_ppe" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_ppe_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_reauthorizations (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "ReauthorizedAt" timestamptz NOT NULL,
        "ReauthorizedBy" uuid NOT NULL,
        CONSTRAINT "PK_permit_reauthorizations" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_reauthorizations_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_revisions (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "Number" integer NOT NULL,
        "CreatedBy" uuid NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        CONSTRAINT "PK_permit_revisions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_revisions_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE TABLE permit_suspensions (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "EventId" uuid,
        "Reason" character varying(500) NOT NULL,
        "SuspendedAt" timestamptz NOT NULL,
        "SuspendedBy" uuid NOT NULL,
        CONSTRAINT "PK_permit_suspensions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_suspensions_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE UNIQUE INDEX "IX_areas_Name" ON areas ("Name");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_atmospheric_tests_PermitId_TestedAt" ON atmospheric_tests ("PermitId", "TestedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_attachments_PermitId" ON attachments ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_equipment_AreaId" ON equipment ("AreaId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_equipment_Tag" ON equipment ("Tag");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_isolations_PermitId" ON isolations ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_approvals_PermitId" ON permit_approvals ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE UNIQUE INDEX "IX_permit_closures_PermitId" ON permit_closures ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_controls_PermitId" ON permit_controls ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_events_PermitId_OccurredAt" ON permit_events ("PermitId", "OccurredAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_extensions_PermitId" ON permit_extensions ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_hazards_PermitId" ON permit_hazards ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_modules_PermitId_Kind" ON permit_modules ("PermitId", "Kind");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_participants_PermitId" ON permit_participants ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_ppe_PermitId" ON permit_ppe ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_reauthorizations_PermitId" ON permit_reauthorizations ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE UNIQUE INDEX "IX_permit_revisions_PermitId_Number" ON permit_revisions ("PermitId", "Number");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permit_suspensions_PermitId" ON permit_suspensions ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_AreaId" ON permits ("AreaId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_ClosedAt" ON permits ("ClosedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_ContractorId" ON permits ("ContractorId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_CreatedAt" ON permits ("CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_CreatedBy" ON permits ("CreatedBy");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_EquipmentId" ON permits ("EquipmentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE UNIQUE INDEX "IX_permits_PermitNumber" ON permits ("PermitNumber");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_PermitType" ON permits ("PermitType");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_Status" ON permits ("Status");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_permits_WorkOrder" ON permits ("WorkOrder");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE UNIQUE INDEX "IX_roles_Name" ON roles ("Name");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_sync_events_ReceivedAt" ON sync_events ("ReceivedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE INDEX "IX_user_roles_RoleId" ON user_roles ("RoleId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    CREATE UNIQUE INDEX "IX_users_Username" ON users ("Username");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022141738_InitialFoundation') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261022141738_InitialFoundation', '9.0.16');
    END IF;
END $EF$;
COMMIT;

