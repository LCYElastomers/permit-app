START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE permits ADD "FormConfigurationVersion" integer;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE equipment ADD "CreatedAt" timestamptz NOT NULL DEFAULT TIMESTAMPTZ '-infinity';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE equipment ADD "Enabled" boolean NOT NULL DEFAULT TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE equipment ADD "EquipmentType" character varying(80);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE equipment ADD "UpdatedAt" timestamptz;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE contractors ADD "CreatedAt" timestamptz NOT NULL DEFAULT TIMESTAMPTZ '-infinity';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE contractors ADD "Enabled" boolean NOT NULL DEFAULT TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE contractors ADD "ShortName" character varying(40);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE contractors ADD "UpdatedAt" timestamptz;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE areas ADD "Enabled" boolean NOT NULL DEFAULT TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    ALTER TABLE areas ADD "UpdatedAt" timestamptz;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE configuration_audits (
        "Id" uuid NOT NULL,
        "PerformedByUserId" uuid NOT NULL,
        "OccurredAt" timestamptz NOT NULL,
        "EntityType" character varying(40) NOT NULL,
        "EntityId" uuid,
        "Action" character varying(40) NOT NULL,
        "Summary" character varying(200) NOT NULL,
        "DeviceId" uuid,
        CONSTRAINT "PK_configuration_audits" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_configuration_audits_users_PerformedByUserId" FOREIGN KEY ("PerformedByUserId") REFERENCES users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE control_definitions (
        "Id" uuid NOT NULL,
        "Code" character varying(40) NOT NULL,
        "Name" character varying(160) NOT NULL,
        "Description" character varying(500),
        "Enabled" boolean NOT NULL,
        "DisplayOrder" integer NOT NULL,
        "ApplicablePermitTypes" text,
        "CreatedAt" timestamptz NOT NULL,
        "UpdatedAt" timestamptz,
        CONSTRAINT "PK_control_definitions" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE form_publications (
        "Id" integer NOT NULL,
        "PublishedVersion" integer NOT NULL,
        "PublishedAt" timestamptz,
        "PublishedByUserId" uuid,
        CONSTRAINT "PK_form_publications" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE hazard_definitions (
        "Id" uuid NOT NULL,
        "Code" character varying(40) NOT NULL,
        "Name" character varying(160) NOT NULL,
        "Description" character varying(500),
        "Enabled" boolean NOT NULL,
        "DisplayOrder" integer NOT NULL,
        "ApplicablePermitTypes" text,
        "CreatedAt" timestamptz NOT NULL,
        "UpdatedAt" timestamptz,
        CONSTRAINT "PK_hazard_definitions" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE permit_field_definitions (
        "Id" uuid NOT NULL,
        "PermitType" character varying(40) NOT NULL,
        "ModuleKind" character varying(40),
        "Code" character varying(40) NOT NULL,
        "Label" character varying(160) NOT NULL,
        "HelpText" character varying(400),
        "FieldType" character varying(32) NOT NULL,
        "Required" boolean NOT NULL,
        "DisplayOrder" integer NOT NULL,
        "Enabled" boolean NOT NULL,
        "ConfigurationVersion" integer NOT NULL,
        CONSTRAINT "PK_permit_field_definitions" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE permit_rules (
        "Id" uuid NOT NULL,
        "ConfigurationVersion" integer NOT NULL,
        "ConditionCode" character varying(40) NOT NULL,
        "ConditionValue" character varying(80) NOT NULL,
        "Action" character varying(40) NOT NULL,
        "ActionTarget" character varying(40) NOT NULL,
        "Enabled" boolean NOT NULL,
        CONSTRAINT "PK_permit_rules" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE ppe_definitions (
        "Id" uuid NOT NULL,
        "Code" character varying(40) NOT NULL,
        "Name" character varying(160) NOT NULL,
        "Description" character varying(500),
        "Enabled" boolean NOT NULL,
        "DisplayOrder" integer NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        "UpdatedAt" timestamptz,
        CONSTRAINT "PK_ppe_definitions" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE work_types (
        "Id" uuid NOT NULL,
        "Code" character varying(40) NOT NULL,
        "Name" character varying(160) NOT NULL,
        "Description" character varying(500),
        "Enabled" boolean NOT NULL,
        "DisplayOrder" integer NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        "UpdatedAt" timestamptz,
        CONSTRAINT "PK_work_types" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE permit_field_choices (
        "Id" uuid NOT NULL,
        "FieldDefinitionId" uuid NOT NULL,
        "Code" character varying(40) NOT NULL,
        "Label" character varying(160) NOT NULL,
        "Description" character varying(400),
        "DisplayOrder" integer NOT NULL,
        "Enabled" boolean NOT NULL,
        CONSTRAINT "PK_permit_field_choices" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_field_choices_permit_field_definitions_FieldDefiniti~" FOREIGN KEY ("FieldDefinitionId") REFERENCES permit_field_definitions ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE permit_templates (
        "Id" uuid NOT NULL,
        "Name" character varying(160) NOT NULL,
        "Description" character varying(500),
        "PermitType" character varying(40) NOT NULL,
        "DefaultAreaId" uuid,
        "DefaultWorkTypeId" uuid,
        "Enabled" boolean NOT NULL,
        "Version" integer NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        "UpdatedAt" timestamptz,
        CONSTRAINT "PK_permit_templates" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_templates_areas_DefaultAreaId" FOREIGN KEY ("DefaultAreaId") REFERENCES areas ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_permit_templates_work_types_DefaultWorkTypeId" FOREIGN KEY ("DefaultWorkTypeId") REFERENCES work_types ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE TABLE permit_template_items (
        "Id" uuid NOT NULL,
        "TemplateId" uuid NOT NULL,
        "Kind" character varying(20) NOT NULL,
        "Code" character varying(40) NOT NULL,
        "Label" character varying(160) NOT NULL,
        CONSTRAINT "PK_permit_template_items" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_template_items_permit_templates_TemplateId" FOREIGN KEY ("TemplateId") REFERENCES permit_templates ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    INSERT INTO form_publications ("Id", "PublishedAt", "PublishedByUserId", "PublishedVersion")
    VALUES (1, NULL, NULL, 0);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE INDEX "IX_configuration_audits_OccurredAt" ON configuration_audits ("OccurredAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE INDEX "IX_configuration_audits_PerformedByUserId" ON configuration_audits ("PerformedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE UNIQUE INDEX "IX_control_definitions_Code" ON control_definitions ("Code");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE UNIQUE INDEX "IX_hazard_definitions_Code" ON hazard_definitions ("Code");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE UNIQUE INDEX "IX_permit_field_choices_FieldDefinitionId_Code" ON permit_field_choices ("FieldDefinitionId", "Code");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE UNIQUE INDEX "IX_permit_field_definitions_PermitType_Code_ConfigurationVersi~" ON permit_field_definitions ("PermitType", "Code", "ConfigurationVersion");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE INDEX "IX_permit_template_items_TemplateId" ON permit_template_items ("TemplateId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE INDEX "IX_permit_templates_DefaultAreaId" ON permit_templates ("DefaultAreaId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE INDEX "IX_permit_templates_DefaultWorkTypeId" ON permit_templates ("DefaultWorkTypeId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE UNIQUE INDEX "IX_ppe_definitions_Code" ON ppe_definitions ("Code");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    CREATE UNIQUE INDEX "IX_work_types_Code" ON work_types ("Code");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023171410_AdministrationCatalogs') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261023171410_AdministrationCatalogs', '9.0.16');
    END IF;
END $EF$;
COMMIT;

