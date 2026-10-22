START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022210547_PermitPdfExport') THEN
    CREATE TABLE permit_exports (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "PermitRevision" integer NOT NULL,
        "ExportType" character varying(40) NOT NULL,
        "StorageKey" character varying(300) NOT NULL,
        "MimeType" character varying(120) NOT NULL,
        "FileSize" bigint NOT NULL,
        "Sha256" character varying(64) NOT NULL,
        "GeneratedAt" timestamptz NOT NULL,
        "GeneratedBy" uuid,
        "DocumentClassification" character varying(40) NOT NULL,
        CONSTRAINT "PK_permit_exports" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_exports_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022210547_PermitPdfExport') THEN
    CREATE INDEX "IX_permit_exports_PermitId" ON permit_exports ("PermitId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022210547_PermitPdfExport') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261022210547_PermitPdfExport', '9.0.16');
    END IF;
END $EF$;
COMMIT;

