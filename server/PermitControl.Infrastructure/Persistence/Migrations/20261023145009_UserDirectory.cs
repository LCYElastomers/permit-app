using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace PermitControl.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserDirectory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_roles_roles_RoleId",
                table: "user_roles");

            migrationBuilder.DropForeignKey(
                name: "FK_user_roles_users_UserId",
                table: "user_roles");

            migrationBuilder.AddColumn<string>(
                name: "Department",
                table: "users",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JobTitle",
                table: "users",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PermitUserCode",
                table: "users",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PersonnelCode",
                table: "users",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PersonnelReference",
                table: "users",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "users",
                type: "timestamptz",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WindowsDomain",
                table: "users",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "WindowsUsername",
                table: "users",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ActingRole",
                table: "permit_events",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayNameSnapshot",
                table: "permit_events",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JobTitleSnapshot",
                table: "permit_events",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermitUserCodeSnapshot",
                table: "permit_events",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WindowsUsernameSnapshot",
                table: "permit_events",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActingRole",
                table: "permit_approvals",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayNameSnapshot",
                table: "permit_approvals",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JobTitleSnapshot",
                table: "permit_approvals",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PermitRevision",
                table: "permit_approvals",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "PermitUserCodeSnapshot",
                table: "permit_approvals",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WindowsUsernameSnapshot",
                table: "permit_approvals",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "credential_audits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    TargetUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PerformedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReasonCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credential_audits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_credential_audits_users_PerformedByUserId",
                        column: x => x.PerformedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_credential_audits_users_TargetUserId",
                        column: x => x.TargetUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "permit_policies",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_policies", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "user_code_counters",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LastValue = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_code_counters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "user_credentials",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    State = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ResumeState = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    PinHash = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    FailedAttempts = table.Column<int>(type: "integer", nullable: false),
                    LockedUntil = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    PinChangedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_credentials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_credentials_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_pin_history",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PinHash = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_pin_history", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_pin_history_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_qualifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    QualificationType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EffectiveDate = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    ExpirationDate = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    VerifiedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_qualifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_qualifications_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_sessions_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "permit_policies",
                columns: new[] { "Key", "Enabled" },
                values: new object[] { "AllowSelfAuthorization", false });

            migrationBuilder.InsertData(
                table: "roles",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { new Guid("a0000001-0000-4000-8000-000000000001"), "SUPER_ADMIN" },
                    { new Guid("a0000002-0000-4000-8000-000000000002"), "ADMIN" },
                    { new Guid("a0000003-0000-4000-8000-000000000003"), "REQUESTER" },
                    { new Guid("a0000004-0000-4000-8000-000000000004"), "PERMIT_AUTHORIZER" },
                    { new Guid("a0000005-0000-4000-8000-000000000005"), "SHIFT_SUPERVISOR" },
                    { new Guid("a0000006-0000-4000-8000-000000000006"), "CRAFT_RECEIVER" },
                    { new Guid("a0000007-0000-4000-8000-000000000007"), "SAFETY" },
                    { new Guid("a0000008-0000-4000-8000-000000000008"), "VIEWER" }
                });

            migrationBuilder.InsertData(
                table: "user_code_counters",
                columns: new[] { "Id", "LastValue" },
                values: new object[] { 1, 8 });

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "Id", "AuthProvider", "CreatedAt", "Department", "DisplayName", "Email", "Enabled", "ExternalSubjectId", "JobTitle", "PermitUserCode", "PersonnelCode", "PersonnelReference", "UpdatedAt", "Username", "WindowsDomain", "WindowsUsername" },
                values: new object[,]
                {
                    { new Guid("b0000001-0000-4000-8000-000000000001"), "LOCAL", new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Bobby Fitzgerald", "pcu-0001@permit-control.local", true, null, "IT Manager", "PCU-0001", "IT", "3100", null, "bobby.fitzgerald", "", "bobby.fitzgerald" },
                    { new Guid("b0000002-0000-4000-8000-000000000002"), "LOCAL", new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Patrick Grigsby", "pcu-0002@permit-control.local", true, null, "Day Supervisor", "PCU-0002", "SS", "5200", null, "patrick.grigsby", "", "patrick.grigsby" },
                    { new Guid("b0000003-0000-4000-8000-000000000003"), "LOCAL", new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Mike Distefano", "pcu-0003@permit-control.local", true, null, "Shift Supervisor", "PCU-0003", "SS", "5200", null, "mike.distefano", "", "mike.distefano" },
                    { new Guid("b0000004-0000-4000-8000-000000000004"), "LOCAL", new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Tommy M Pantoja", "pcu-0004@permit-control.local", true, null, "Shift Supervisor", "PCU-0004", "SS", "5200", null, "tommy.pantoja", "", "tommy.pantoja" },
                    { new Guid("b0000005-0000-4000-8000-000000000005"), "LOCAL", new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "John B. Fugere", "pcu-0005@permit-control.local", true, null, "Shift Supervisor", "PCU-0005", "SS", "5200", null, "john.fugere", "", "john.fugere" },
                    { new Guid("b0000006-0000-4000-8000-000000000006"), "LOCAL", new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Cody Lane Stanfill", "pcu-0006@permit-control.local", true, null, "Finishing Board Operator", "PCU-0006", "STEPUP", "5200", null, "cody.stanfill", "", "cody.stanfill" },
                    { new Guid("b0000007-0000-4000-8000-000000000007"), "LOCAL", new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Myral Niemtschk", "pcu-0007@permit-control.local", true, null, "Finishing Board Operator", "PCU-0007", "STEPUP", "5200", null, "myral.niemtschk", "", "myral.niemtschk" },
                    { new Guid("b0000008-0000-4000-8000-000000000008"), "LOCAL", new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Angie Balderaz", "pcu-0008@permit-control.local", true, null, "Reaction Board Operator", "PCU-0008", "RBOP", "5200", null, "angie.balderaz", "", "angie.balderaz" }
                });

            migrationBuilder.InsertData(
                table: "user_credentials",
                columns: new[] { "Id", "CreatedAt", "FailedAttempts", "LockedUntil", "PinChangedAt", "PinHash", "ResumeState", "State", "UpdatedAt", "UserId" },
                values: new object[,]
                {
                    { new Guid("c0000001-0000-4000-8000-000000000001"), new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 0, null, null, null, null, "NOT_ENROLLED", null, new Guid("b0000001-0000-4000-8000-000000000001") },
                    { new Guid("c0000002-0000-4000-8000-000000000002"), new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 0, null, null, null, null, "NOT_ENROLLED", null, new Guid("b0000002-0000-4000-8000-000000000002") },
                    { new Guid("c0000003-0000-4000-8000-000000000003"), new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 0, null, null, null, null, "NOT_ENROLLED", null, new Guid("b0000003-0000-4000-8000-000000000003") },
                    { new Guid("c0000004-0000-4000-8000-000000000004"), new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 0, null, null, null, null, "NOT_ENROLLED", null, new Guid("b0000004-0000-4000-8000-000000000004") },
                    { new Guid("c0000005-0000-4000-8000-000000000005"), new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 0, null, null, null, null, "NOT_ENROLLED", null, new Guid("b0000005-0000-4000-8000-000000000005") },
                    { new Guid("c0000006-0000-4000-8000-000000000006"), new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 0, null, null, null, null, "NOT_ENROLLED", null, new Guid("b0000006-0000-4000-8000-000000000006") },
                    { new Guid("c0000007-0000-4000-8000-000000000007"), new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 0, null, null, null, null, "NOT_ENROLLED", null, new Guid("b0000007-0000-4000-8000-000000000007") },
                    { new Guid("c0000008-0000-4000-8000-000000000008"), new DateTimeOffset(new DateTime(2026, 10, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 0, null, null, null, null, "NOT_ENROLLED", null, new Guid("b0000008-0000-4000-8000-000000000008") }
                });

            migrationBuilder.InsertData(
                table: "user_roles",
                columns: new[] { "RoleId", "UserId" },
                values: new object[,]
                {
                    { new Guid("a0000001-0000-4000-8000-000000000001"), new Guid("b0000001-0000-4000-8000-000000000001") },
                    { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000002-0000-4000-8000-000000000002") },
                    { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000002-0000-4000-8000-000000000002") },
                    { new Guid("a0000005-0000-4000-8000-000000000005"), new Guid("b0000002-0000-4000-8000-000000000002") },
                    { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000003-0000-4000-8000-000000000003") },
                    { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000003-0000-4000-8000-000000000003") },
                    { new Guid("a0000005-0000-4000-8000-000000000005"), new Guid("b0000003-0000-4000-8000-000000000003") },
                    { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000004-0000-4000-8000-000000000004") },
                    { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000004-0000-4000-8000-000000000004") },
                    { new Guid("a0000005-0000-4000-8000-000000000005"), new Guid("b0000004-0000-4000-8000-000000000004") },
                    { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000005-0000-4000-8000-000000000005") },
                    { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000005-0000-4000-8000-000000000005") },
                    { new Guid("a0000005-0000-4000-8000-000000000005"), new Guid("b0000005-0000-4000-8000-000000000005") },
                    { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000006-0000-4000-8000-000000000006") },
                    { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000006-0000-4000-8000-000000000006") },
                    { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000007-0000-4000-8000-000000000007") },
                    { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000007-0000-4000-8000-000000000007") },
                    { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000008-0000-4000-8000-000000000008") },
                    { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000008-0000-4000-8000-000000000008") }
                });

            migrationBuilder.CreateIndex(
                name: "IX_users_PermitUserCode",
                table: "users",
                column: "PermitUserCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_WindowsDomain_WindowsUsername",
                table: "users",
                columns: new[] { "WindowsDomain", "WindowsUsername" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_permit_approvals_UserId",
                table: "permit_approvals",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_credential_audits_PerformedByUserId",
                table: "credential_audits",
                column: "PerformedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_credential_audits_TargetUserId_OccurredAt",
                table: "credential_audits",
                columns: new[] { "TargetUserId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_user_credentials_UserId",
                table: "user_credentials",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_pin_history_UserId_CreatedAt",
                table: "user_pin_history",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_user_qualifications_UserId_QualificationType",
                table: "user_qualifications",
                columns: new[] { "UserId", "QualificationType" });

            migrationBuilder.CreateIndex(
                name: "IX_user_sessions_TokenHash",
                table: "user_sessions",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_sessions_UserId",
                table: "user_sessions",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_permit_approvals_users_UserId",
                table: "permit_approvals",
                column: "UserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_user_roles_roles_RoleId",
                table: "user_roles",
                column: "RoleId",
                principalTable: "roles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_user_roles_users_UserId",
                table: "user_roles",
                column: "UserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_permit_approvals_users_UserId",
                table: "permit_approvals");

            migrationBuilder.DropForeignKey(
                name: "FK_user_roles_roles_RoleId",
                table: "user_roles");

            migrationBuilder.DropForeignKey(
                name: "FK_user_roles_users_UserId",
                table: "user_roles");

            migrationBuilder.DropTable(
                name: "credential_audits");

            migrationBuilder.DropTable(
                name: "permit_policies");

            migrationBuilder.DropTable(
                name: "user_code_counters");

            migrationBuilder.DropTable(
                name: "user_credentials");

            migrationBuilder.DropTable(
                name: "user_pin_history");

            migrationBuilder.DropTable(
                name: "user_qualifications");

            migrationBuilder.DropTable(
                name: "user_sessions");

            migrationBuilder.DropIndex(
                name: "IX_users_PermitUserCode",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_WindowsDomain_WindowsUsername",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_permit_approvals_UserId",
                table: "permit_approvals");

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-4000-8000-000000000002"));

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: new Guid("a0000006-0000-4000-8000-000000000006"));

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: new Guid("a0000007-0000-4000-8000-000000000007"));

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: new Guid("a0000008-0000-4000-8000-000000000008"));

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000001-0000-4000-8000-000000000001"), new Guid("b0000001-0000-4000-8000-000000000001") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000002-0000-4000-8000-000000000002") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000002-0000-4000-8000-000000000002") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000005-0000-4000-8000-000000000005"), new Guid("b0000002-0000-4000-8000-000000000002") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000003-0000-4000-8000-000000000003") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000003-0000-4000-8000-000000000003") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000005-0000-4000-8000-000000000005"), new Guid("b0000003-0000-4000-8000-000000000003") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000004-0000-4000-8000-000000000004") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000004-0000-4000-8000-000000000004") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000005-0000-4000-8000-000000000005"), new Guid("b0000004-0000-4000-8000-000000000004") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000005-0000-4000-8000-000000000005") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000005-0000-4000-8000-000000000005") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000005-0000-4000-8000-000000000005"), new Guid("b0000005-0000-4000-8000-000000000005") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000006-0000-4000-8000-000000000006") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000006-0000-4000-8000-000000000006") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000007-0000-4000-8000-000000000007") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000007-0000-4000-8000-000000000007") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000003-0000-4000-8000-000000000003"), new Guid("b0000008-0000-4000-8000-000000000008") });

            migrationBuilder.DeleteData(
                table: "user_roles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { new Guid("a0000004-0000-4000-8000-000000000004"), new Guid("b0000008-0000-4000-8000-000000000008") });

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-4000-8000-000000000001"));

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-4000-8000-000000000003"));

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-4000-8000-000000000004"));

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: new Guid("a0000005-0000-4000-8000-000000000005"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: new Guid("b0000001-0000-4000-8000-000000000001"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: new Guid("b0000002-0000-4000-8000-000000000002"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: new Guid("b0000003-0000-4000-8000-000000000003"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: new Guid("b0000004-0000-4000-8000-000000000004"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: new Guid("b0000005-0000-4000-8000-000000000005"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: new Guid("b0000006-0000-4000-8000-000000000006"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: new Guid("b0000007-0000-4000-8000-000000000007"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: new Guid("b0000008-0000-4000-8000-000000000008"));

            migrationBuilder.DropColumn(
                name: "Department",
                table: "users");

            migrationBuilder.DropColumn(
                name: "JobTitle",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PermitUserCode",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PersonnelCode",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PersonnelReference",
                table: "users");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "users");

            migrationBuilder.DropColumn(
                name: "WindowsDomain",
                table: "users");

            migrationBuilder.DropColumn(
                name: "WindowsUsername",
                table: "users");

            migrationBuilder.DropColumn(
                name: "ActingRole",
                table: "permit_events");

            migrationBuilder.DropColumn(
                name: "DisplayNameSnapshot",
                table: "permit_events");

            migrationBuilder.DropColumn(
                name: "JobTitleSnapshot",
                table: "permit_events");

            migrationBuilder.DropColumn(
                name: "PermitUserCodeSnapshot",
                table: "permit_events");

            migrationBuilder.DropColumn(
                name: "WindowsUsernameSnapshot",
                table: "permit_events");

            migrationBuilder.DropColumn(
                name: "ActingRole",
                table: "permit_approvals");

            migrationBuilder.DropColumn(
                name: "DisplayNameSnapshot",
                table: "permit_approvals");

            migrationBuilder.DropColumn(
                name: "JobTitleSnapshot",
                table: "permit_approvals");

            migrationBuilder.DropColumn(
                name: "PermitRevision",
                table: "permit_approvals");

            migrationBuilder.DropColumn(
                name: "PermitUserCodeSnapshot",
                table: "permit_approvals");

            migrationBuilder.DropColumn(
                name: "WindowsUsernameSnapshot",
                table: "permit_approvals");

            migrationBuilder.AddForeignKey(
                name: "FK_user_roles_roles_RoleId",
                table: "user_roles",
                column: "RoleId",
                principalTable: "roles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_user_roles_users_UserId",
                table: "user_roles",
                column: "UserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
