START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE user_roles DROP CONSTRAINT "FK_user_roles_roles_RoleId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE user_roles DROP CONSTRAINT "FK_user_roles_users_UserId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE users ADD "Department" character varying(120);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE users ADD "JobTitle" character varying(120) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE users ADD "PermitUserCode" character varying(16) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE users ADD "PersonnelCode" character varying(40) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE users ADD "PersonnelReference" character varying(40) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE users ADD "UpdatedAt" timestamptz;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE users ADD "WindowsDomain" character varying(80) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE users ADD "WindowsUsername" character varying(80) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_events ADD "ActingRole" character varying(40);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_events ADD "DisplayNameSnapshot" character varying(160);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_events ADD "JobTitleSnapshot" character varying(120);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_events ADD "PermitUserCodeSnapshot" character varying(16);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_events ADD "WindowsUsernameSnapshot" character varying(80);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_approvals ADD "ActingRole" character varying(40);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_approvals ADD "DisplayNameSnapshot" character varying(160);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_approvals ADD "JobTitleSnapshot" character varying(120);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_approvals ADD "PermitRevision" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_approvals ADD "PermitUserCodeSnapshot" character varying(16);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_approvals ADD "WindowsUsernameSnapshot" character varying(80);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE TABLE credential_audits (
        "Id" uuid NOT NULL,
        "EventType" character varying(40) NOT NULL,
        "TargetUserId" uuid NOT NULL,
        "PerformedByUserId" uuid NOT NULL,
        "OccurredAt" timestamptz NOT NULL,
        "DeviceId" uuid,
        "ReasonCode" character varying(80),
        CONSTRAINT "PK_credential_audits" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_credential_audits_users_PerformedByUserId" FOREIGN KEY ("PerformedByUserId") REFERENCES users ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_credential_audits_users_TargetUserId" FOREIGN KEY ("TargetUserId") REFERENCES users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE TABLE permit_policies (
        "Key" character varying(80) NOT NULL,
        "Enabled" boolean NOT NULL,
        CONSTRAINT "PK_permit_policies" PRIMARY KEY ("Key")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE TABLE user_code_counters (
        "Id" integer GENERATED BY DEFAULT AS IDENTITY,
        "LastValue" integer NOT NULL,
        CONSTRAINT "PK_user_code_counters" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE TABLE user_credentials (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "State" character varying(32) NOT NULL,
        "ResumeState" character varying(32),
        "PinHash" character varying(400),
        "FailedAttempts" integer NOT NULL,
        "LockedUntil" timestamptz,
        "PinChangedAt" timestamptz,
        "CreatedAt" timestamptz NOT NULL,
        "UpdatedAt" timestamptz,
        CONSTRAINT "PK_user_credentials" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_user_credentials_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE TABLE user_pin_history (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "PinHash" character varying(400) NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        CONSTRAINT "PK_user_pin_history" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_user_pin_history_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE TABLE user_qualifications (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "QualificationType" character varying(40) NOT NULL,
        "EffectiveDate" timestamptz,
        "ExpirationDate" timestamptz,
        "Enabled" boolean NOT NULL,
        "VerifiedByUserId" uuid,
        "Notes" character varying(400),
        "CreatedAt" timestamptz NOT NULL,
        "UpdatedAt" timestamptz,
        CONSTRAINT "PK_user_qualifications" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_user_qualifications_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE TABLE user_sessions (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "TokenHash" character varying(64) NOT NULL,
        "CreatedAt" timestamptz NOT NULL,
        "ExpiresAt" timestamptz NOT NULL,
        "RevokedAt" timestamptz,
        CONSTRAINT "PK_user_sessions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_user_sessions_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    INSERT INTO permit_policies ("Key", "Enabled")
    VALUES ('AllowSelfAuthorization', FALSE);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    INSERT INTO roles ("Id", "Name")
    VALUES ('a0000001-0000-4000-8000-000000000001', 'SUPER_ADMIN');
    INSERT INTO roles ("Id", "Name")
    VALUES ('a0000002-0000-4000-8000-000000000002', 'ADMIN');
    INSERT INTO roles ("Id", "Name")
    VALUES ('a0000003-0000-4000-8000-000000000003', 'REQUESTER');
    INSERT INTO roles ("Id", "Name")
    VALUES ('a0000004-0000-4000-8000-000000000004', 'PERMIT_AUTHORIZER');
    INSERT INTO roles ("Id", "Name")
    VALUES ('a0000005-0000-4000-8000-000000000005', 'SHIFT_SUPERVISOR');
    INSERT INTO roles ("Id", "Name")
    VALUES ('a0000006-0000-4000-8000-000000000006', 'CRAFT_RECEIVER');
    INSERT INTO roles ("Id", "Name")
    VALUES ('a0000007-0000-4000-8000-000000000007', 'SAFETY');
    INSERT INTO roles ("Id", "Name")
    VALUES ('a0000008-0000-4000-8000-000000000008', 'VIEWER');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    INSERT INTO user_code_counters ("Id", "LastValue")
    VALUES (1, 8);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    INSERT INTO users ("Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername")
    VALUES ('b0000001-0000-4000-8000-000000000001', 'LOCAL', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', NULL, 'Bobby Fitzgerald', 'pcu-0001@permit-control.local', TRUE, NULL, 'IT Manager', 'PCU-0001', 'IT', '3100', NULL, 'bobby.fitzgerald', '', 'bobby.fitzgerald');
    INSERT INTO users ("Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername")
    VALUES ('b0000002-0000-4000-8000-000000000002', 'LOCAL', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', NULL, 'Patrick Grigsby', 'pcu-0002@permit-control.local', TRUE, NULL, 'Day Supervisor', 'PCU-0002', 'SS', '5200', NULL, 'patrick.grigsby', '', 'patrick.grigsby');
    INSERT INTO users ("Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername")
    VALUES ('b0000003-0000-4000-8000-000000000003', 'LOCAL', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', NULL, 'Mike Distefano', 'pcu-0003@permit-control.local', TRUE, NULL, 'Shift Supervisor', 'PCU-0003', 'SS', '5200', NULL, 'mike.distefano', '', 'mike.distefano');
    INSERT INTO users ("Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername")
    VALUES ('b0000004-0000-4000-8000-000000000004', 'LOCAL', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', NULL, 'Tommy M Pantoja', 'pcu-0004@permit-control.local', TRUE, NULL, 'Shift Supervisor', 'PCU-0004', 'SS', '5200', NULL, 'tommy.pantoja', '', 'tommy.pantoja');
    INSERT INTO users ("Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername")
    VALUES ('b0000005-0000-4000-8000-000000000005', 'LOCAL', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', NULL, 'John B. Fugere', 'pcu-0005@permit-control.local', TRUE, NULL, 'Shift Supervisor', 'PCU-0005', 'SS', '5200', NULL, 'john.fugere', '', 'john.fugere');
    INSERT INTO users ("Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername")
    VALUES ('b0000006-0000-4000-8000-000000000006', 'LOCAL', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', NULL, 'Cody Lane Stanfill', 'pcu-0006@permit-control.local', TRUE, NULL, 'Finishing Board Operator', 'PCU-0006', 'STEPUP', '5200', NULL, 'cody.stanfill', '', 'cody.stanfill');
    INSERT INTO users ("Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername")
    VALUES ('b0000007-0000-4000-8000-000000000007', 'LOCAL', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', NULL, 'Myral Niemtschk', 'pcu-0007@permit-control.local', TRUE, NULL, 'Finishing Board Operator', 'PCU-0007', 'STEPUP', '5200', NULL, 'myral.niemtschk', '', 'myral.niemtschk');
    INSERT INTO users ("Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername")
    VALUES ('b0000008-0000-4000-8000-000000000008', 'LOCAL', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', NULL, 'Angie Balderaz', 'pcu-0008@permit-control.local', TRUE, NULL, 'Reaction Board Operator', 'PCU-0008', 'RBOP', '5200', NULL, 'angie.balderaz', '', 'angie.balderaz');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    INSERT INTO user_credentials ("Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId")
    VALUES ('c0000001-0000-4000-8000-000000000001', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', 0, NULL, NULL, NULL, NULL, 'NOT_ENROLLED', NULL, 'b0000001-0000-4000-8000-000000000001');
    INSERT INTO user_credentials ("Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId")
    VALUES ('c0000002-0000-4000-8000-000000000002', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', 0, NULL, NULL, NULL, NULL, 'NOT_ENROLLED', NULL, 'b0000002-0000-4000-8000-000000000002');
    INSERT INTO user_credentials ("Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId")
    VALUES ('c0000003-0000-4000-8000-000000000003', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', 0, NULL, NULL, NULL, NULL, 'NOT_ENROLLED', NULL, 'b0000003-0000-4000-8000-000000000003');
    INSERT INTO user_credentials ("Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId")
    VALUES ('c0000004-0000-4000-8000-000000000004', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', 0, NULL, NULL, NULL, NULL, 'NOT_ENROLLED', NULL, 'b0000004-0000-4000-8000-000000000004');
    INSERT INTO user_credentials ("Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId")
    VALUES ('c0000005-0000-4000-8000-000000000005', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', 0, NULL, NULL, NULL, NULL, 'NOT_ENROLLED', NULL, 'b0000005-0000-4000-8000-000000000005');
    INSERT INTO user_credentials ("Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId")
    VALUES ('c0000006-0000-4000-8000-000000000006', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', 0, NULL, NULL, NULL, NULL, 'NOT_ENROLLED', NULL, 'b0000006-0000-4000-8000-000000000006');
    INSERT INTO user_credentials ("Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId")
    VALUES ('c0000007-0000-4000-8000-000000000007', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', 0, NULL, NULL, NULL, NULL, 'NOT_ENROLLED', NULL, 'b0000007-0000-4000-8000-000000000007');
    INSERT INTO user_credentials ("Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId")
    VALUES ('c0000008-0000-4000-8000-000000000008', TIMESTAMPTZ '2026-10-23T00:00:00+00:00', 0, NULL, NULL, NULL, NULL, 'NOT_ENROLLED', NULL, 'b0000008-0000-4000-8000-000000000008');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000003-0000-4000-8000-000000000003', 'b0000002-0000-4000-8000-000000000002');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000004-0000-4000-8000-000000000004', 'b0000002-0000-4000-8000-000000000002');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000005-0000-4000-8000-000000000005', 'b0000002-0000-4000-8000-000000000002');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000003-0000-4000-8000-000000000003', 'b0000003-0000-4000-8000-000000000003');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000004-0000-4000-8000-000000000004', 'b0000003-0000-4000-8000-000000000003');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000005-0000-4000-8000-000000000005', 'b0000003-0000-4000-8000-000000000003');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000003-0000-4000-8000-000000000003', 'b0000004-0000-4000-8000-000000000004');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000004-0000-4000-8000-000000000004', 'b0000004-0000-4000-8000-000000000004');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000005-0000-4000-8000-000000000005', 'b0000004-0000-4000-8000-000000000004');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000003-0000-4000-8000-000000000003', 'b0000005-0000-4000-8000-000000000005');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000004-0000-4000-8000-000000000004', 'b0000005-0000-4000-8000-000000000005');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000005-0000-4000-8000-000000000005', 'b0000005-0000-4000-8000-000000000005');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000003-0000-4000-8000-000000000003', 'b0000006-0000-4000-8000-000000000006');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000004-0000-4000-8000-000000000004', 'b0000006-0000-4000-8000-000000000006');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000003-0000-4000-8000-000000000003', 'b0000007-0000-4000-8000-000000000007');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000004-0000-4000-8000-000000000004', 'b0000007-0000-4000-8000-000000000007');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000003-0000-4000-8000-000000000003', 'b0000008-0000-4000-8000-000000000008');
    INSERT INTO user_roles ("RoleId", "UserId")
    VALUES ('a0000004-0000-4000-8000-000000000004', 'b0000008-0000-4000-8000-000000000008');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE UNIQUE INDEX "IX_users_PermitUserCode" ON users ("PermitUserCode");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE UNIQUE INDEX "IX_users_WindowsDomain_WindowsUsername" ON users ("WindowsDomain", "WindowsUsername");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE INDEX "IX_permit_approvals_UserId" ON permit_approvals ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE INDEX "IX_credential_audits_PerformedByUserId" ON credential_audits ("PerformedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE INDEX "IX_credential_audits_TargetUserId_OccurredAt" ON credential_audits ("TargetUserId", "OccurredAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE UNIQUE INDEX "IX_user_credentials_UserId" ON user_credentials ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE INDEX "IX_user_pin_history_UserId_CreatedAt" ON user_pin_history ("UserId", "CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE INDEX "IX_user_qualifications_UserId_QualificationType" ON user_qualifications ("UserId", "QualificationType");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE UNIQUE INDEX "IX_user_sessions_TokenHash" ON user_sessions ("TokenHash");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    CREATE INDEX "IX_user_sessions_UserId" ON user_sessions ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE permit_approvals ADD CONSTRAINT "FK_permit_approvals_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE user_roles ADD CONSTRAINT "FK_user_roles_roles_RoleId" FOREIGN KEY ("RoleId") REFERENCES roles ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    ALTER TABLE user_roles ADD CONSTRAINT "FK_user_roles_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    PERFORM setval(
        pg_get_serial_sequence('user_code_counters', 'Id'),
        GREATEST(
            (SELECT MAX("Id") FROM user_code_counters) + 1,
            nextval(pg_get_serial_sequence('user_code_counters', 'Id'))),
        false);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261023145009_UserDirectory') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261023145009_UserDirectory', '9.0.16');
    END IF;
END $EF$;
COMMIT;

