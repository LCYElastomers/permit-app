using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PermitControl.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "areas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_areas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "contractors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contractors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "devices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_devices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_closures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ClosedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_closures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_controls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleId = table.Column<Guid>(type: "uuid", nullable: true),
                    Label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_controls", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_extensions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    PreviousExpiresAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    NewExpiresAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ExtendedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ExtendedBy = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_extensions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_hazards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleId = table.Column<Guid>(type: "uuid", nullable: true),
                    Label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_hazards", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_ppe",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_ppe", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_reauthorizations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReauthorizedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ReauthorizedBy = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_reauthorizations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_suspensions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SuspendedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    SuspendedBy = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_suspensions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sync_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: true),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: true),
                    EventType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Username = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AuthProvider = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ExternalSubjectId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "equipment",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tag = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_equipment", x => x.Id);
                    table.ForeignKey(
                        name: "FK_equipment_areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_roles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_user_roles_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_roles_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "permits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PermitType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    WorkOrder = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    JobDescription = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CompanyType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ContractorId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    PlannedStart = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ActivatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    CurrentRevision = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permits_areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_permits_contractors_ContractorId",
                        column: x => x.ContractorId,
                        principalTable: "contractors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_permits_equipment_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "equipment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_permits_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "atmospheric_tests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleId = table.Column<Guid>(type: "uuid", nullable: true),
                    TestedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    OxygenPercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    LelPercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    CarbonMonoxidePpm = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    TesterUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Result = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_atmospheric_tests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_atmospheric_tests_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitRevisionId = table.Column<Guid>(type: "uuid", nullable: true),
                    OriginalFilename = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    StoredFilename = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    StorageProvider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    MimeType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    SupersededBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_attachments_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "isolations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleId = table.Column<Guid>(type: "uuid", nullable: true),
                    Plan = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    LockBox = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    ZeroEnergyVerifiedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    VerifiedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_isolations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_isolations_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "permit_approvals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Decision = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    DecidedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_approvals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_approvals_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "permit_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitRevision = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Payload = table.Column<string>(type: "jsonb", nullable: true),
                    SyncSource = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_events_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "permit_modules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Required = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_modules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_modules_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "permit_participants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DisplayName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_participants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_participants_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "permit_revisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_revisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_revisions_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_areas_Name",
                table: "areas",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_atmospheric_tests_PermitId_TestedAt",
                table: "atmospheric_tests",
                columns: new[] { "PermitId", "TestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_attachments_PermitId",
                table: "attachments",
                column: "PermitId");

            migrationBuilder.CreateIndex(
                name: "IX_equipment_AreaId",
                table: "equipment",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_equipment_Tag",
                table: "equipment",
                column: "Tag");

            migrationBuilder.CreateIndex(
                name: "IX_isolations_PermitId",
                table: "isolations",
                column: "PermitId");

            migrationBuilder.CreateIndex(
                name: "IX_permit_approvals_PermitId",
                table: "permit_approvals",
                column: "PermitId");

            migrationBuilder.CreateIndex(
                name: "IX_permit_closures_PermitId",
                table: "permit_closures",
                column: "PermitId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_permit_events_PermitId_OccurredAt",
                table: "permit_events",
                columns: new[] { "PermitId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_permit_modules_PermitId_Kind",
                table: "permit_modules",
                columns: new[] { "PermitId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_permit_participants_PermitId",
                table: "permit_participants",
                column: "PermitId");

            migrationBuilder.CreateIndex(
                name: "IX_permit_revisions_PermitId_Number",
                table: "permit_revisions",
                columns: new[] { "PermitId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_permit_suspensions_PermitId",
                table: "permit_suspensions",
                column: "PermitId");

            migrationBuilder.CreateIndex(
                name: "IX_permits_AreaId",
                table: "permits",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_permits_ClosedAt",
                table: "permits",
                column: "ClosedAt");

            migrationBuilder.CreateIndex(
                name: "IX_permits_ContractorId",
                table: "permits",
                column: "ContractorId");

            migrationBuilder.CreateIndex(
                name: "IX_permits_CreatedAt",
                table: "permits",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_permits_CreatedBy",
                table: "permits",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_permits_EquipmentId",
                table: "permits",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_permits_PermitNumber",
                table: "permits",
                column: "PermitNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_permits_PermitType",
                table: "permits",
                column: "PermitType");

            migrationBuilder.CreateIndex(
                name: "IX_permits_Status",
                table: "permits",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_permits_WorkOrder",
                table: "permits",
                column: "WorkOrder");

            migrationBuilder.CreateIndex(
                name: "IX_roles_Name",
                table: "roles",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sync_events_ReceivedAt",
                table: "sync_events",
                column: "ReceivedAt");

            migrationBuilder.CreateIndex(
                name: "IX_user_roles_RoleId",
                table: "user_roles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                table: "users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "atmospheric_tests");

            migrationBuilder.DropTable(
                name: "attachments");

            migrationBuilder.DropTable(
                name: "devices");

            migrationBuilder.DropTable(
                name: "isolations");

            migrationBuilder.DropTable(
                name: "permit_approvals");

            migrationBuilder.DropTable(
                name: "permit_closures");

            migrationBuilder.DropTable(
                name: "permit_controls");

            migrationBuilder.DropTable(
                name: "permit_events");

            migrationBuilder.DropTable(
                name: "permit_extensions");

            migrationBuilder.DropTable(
                name: "permit_hazards");

            migrationBuilder.DropTable(
                name: "permit_modules");

            migrationBuilder.DropTable(
                name: "permit_participants");

            migrationBuilder.DropTable(
                name: "permit_ppe");

            migrationBuilder.DropTable(
                name: "permit_reauthorizations");

            migrationBuilder.DropTable(
                name: "permit_revisions");

            migrationBuilder.DropTable(
                name: "permit_suspensions");

            migrationBuilder.DropTable(
                name: "sync_events");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "permits");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "contractors");

            migrationBuilder.DropTable(
                name: "equipment");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "areas");
        }
    }
}
