START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023135833_PermitModuleFacts') THEN
    CREATE TABLE permit_module_facts (
        "Id" uuid NOT NULL,
        "PermitId" uuid NOT NULL,
        "ModuleKind" character varying(40) NOT NULL,
        "Name" character varying(80) NOT NULL,
        "Value" character varying(500) NOT NULL,
        CONSTRAINT "PK_permit_module_facts" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_permit_module_facts_permits_PermitId" FOREIGN KEY ("PermitId") REFERENCES permits ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023135833_PermitModuleFacts') THEN
    CREATE UNIQUE INDEX "IX_permit_module_facts_PermitId_ModuleKind_Name" ON permit_module_facts ("PermitId", "ModuleKind", "Name");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023135833_PermitModuleFacts') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261023135833_PermitModuleFacts', '9.0.16');
    END IF;
END $EF$;
COMMIT;

