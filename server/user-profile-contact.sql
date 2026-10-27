START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027150430_UserProfileContact') THEN
    ALTER TABLE users ADD "AlternatePhone" character varying(20);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027150430_UserProfileContact') THEN
    ALTER TABLE users ADD "MobilePhone" character varying(20);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027150430_UserProfileContact') THEN
    ALTER TABLE users ADD "MobileVerifiedAt" timestamptz;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027150430_UserProfileContact') THEN
    CREATE TABLE user_notification_preferences (
        "UserId" uuid NOT NULL,
        "Channel" character varying(16) NOT NULL,
        "Topic" character varying(40) NOT NULL,
        "Enabled" boolean NOT NULL,
        CONSTRAINT "PK_user_notification_preferences" PRIMARY KEY ("UserId", "Channel", "Topic"),
        CONSTRAINT "FK_user_notification_preferences_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027150430_UserProfileContact') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261027150430_UserProfileContact', '9.0.16');
    END IF;
END $EF$;
COMMIT;

