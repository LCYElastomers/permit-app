START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022194128_GeneralWorkPermitSync') THEN
    ALTER TABLE permits ALTER COLUMN "PlannedStart" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022194128_GeneralWorkPermitSync') THEN
    ALTER TABLE permits ALTER COLUMN "ExpiresAt" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022194128_GeneralWorkPermitSync') THEN
    ALTER TABLE permits ALTER COLUMN "CreatedBy" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022194128_GeneralWorkPermitSync') THEN
    ALTER TABLE permits ALTER COLUMN "AreaId" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022194128_GeneralWorkPermitSync') THEN
    ALTER TABLE permit_revisions ALTER COLUMN "CreatedBy" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022194128_GeneralWorkPermitSync') THEN
    CREATE TABLE permit_number_counters (
        "Year" integer NOT NULL,
        "LastValue" integer NOT NULL,
        CONSTRAINT "PK_permit_number_counters" PRIMARY KEY ("Year")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261022194128_GeneralWorkPermitSync') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261022194128_GeneralWorkPermitSync', '9.0.16');
    END IF;
END $EF$;
COMMIT;

