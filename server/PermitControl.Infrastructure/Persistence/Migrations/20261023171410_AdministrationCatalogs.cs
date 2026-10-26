using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PermitControl.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdministrationCatalogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FormConfigurationVersion",
                table: "permits",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "equipment",
                type: "timestamptz",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<bool>(
                name: "Enabled",
                table: "equipment",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "EquipmentType",
                table: "equipment",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "equipment",
                type: "timestamptz",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "contractors",
                type: "timestamptz",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<bool>(
                name: "Enabled",
                table: "contractors",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "ShortName",
                table: "contractors",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "contractors",
                type: "timestamptz",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Enabled",
                table: "areas",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "areas",
                type: "timestamptz",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "configuration_audits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PerformedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Summary = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_configuration_audits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_configuration_audits_users_PerformedByUserId",
                        column: x => x.PerformedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "control_definitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    ApplicablePermitTypes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_control_definitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "form_publications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    PublishedVersion = table.Column<int>(type: "integer", nullable: false),
                    PublishedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    PublishedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_form_publications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "hazard_definitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    ApplicablePermitTypes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hazard_definitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_field_definitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ModuleKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    HelpText = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    FieldType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Required = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    ConfigurationVersion = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_field_definitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_rules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConfigurationVersion = table.Column<int>(type: "integer", nullable: false),
                    ConditionCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ConditionValue = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Action = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ActionTarget = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ppe_definitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ppe_definitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "work_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "permit_field_choices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FieldDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_field_choices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_field_choices_permit_field_definitions_FieldDefiniti~",
                        column: x => x.FieldDefinitionId,
                        principalTable: "permit_field_definitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "permit_templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PermitType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    DefaultAreaId = table.Column<Guid>(type: "uuid", nullable: true),
                    DefaultWorkTypeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_templates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_templates_areas_DefaultAreaId",
                        column: x => x.DefaultAreaId,
                        principalTable: "areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_permit_templates_work_types_DefaultWorkTypeId",
                        column: x => x.DefaultWorkTypeId,
                        principalTable: "work_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "permit_template_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_template_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_template_items_permit_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "permit_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "form_publications",
                columns: new[] { "Id", "PublishedAt", "PublishedByUserId", "PublishedVersion" },
                values: new object[] { 1, null, null, 0 });

            migrationBuilder.CreateIndex(
                name: "IX_configuration_audits_OccurredAt",
                table: "configuration_audits",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_configuration_audits_PerformedByUserId",
                table: "configuration_audits",
                column: "PerformedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_control_definitions_Code",
                table: "control_definitions",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_hazard_definitions_Code",
                table: "hazard_definitions",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_permit_field_choices_FieldDefinitionId_Code",
                table: "permit_field_choices",
                columns: new[] { "FieldDefinitionId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_permit_field_definitions_PermitType_Code_ConfigurationVersi~",
                table: "permit_field_definitions",
                columns: new[] { "PermitType", "Code", "ConfigurationVersion" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_permit_template_items_TemplateId",
                table: "permit_template_items",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_permit_templates_DefaultAreaId",
                table: "permit_templates",
                column: "DefaultAreaId");

            migrationBuilder.CreateIndex(
                name: "IX_permit_templates_DefaultWorkTypeId",
                table: "permit_templates",
                column: "DefaultWorkTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_ppe_definitions_Code",
                table: "ppe_definitions",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_work_types_Code",
                table: "work_types",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "configuration_audits");

            migrationBuilder.DropTable(
                name: "control_definitions");

            migrationBuilder.DropTable(
                name: "form_publications");

            migrationBuilder.DropTable(
                name: "hazard_definitions");

            migrationBuilder.DropTable(
                name: "permit_field_choices");

            migrationBuilder.DropTable(
                name: "permit_rules");

            migrationBuilder.DropTable(
                name: "permit_template_items");

            migrationBuilder.DropTable(
                name: "ppe_definitions");

            migrationBuilder.DropTable(
                name: "permit_field_definitions");

            migrationBuilder.DropTable(
                name: "permit_templates");

            migrationBuilder.DropTable(
                name: "work_types");

            migrationBuilder.DropColumn(
                name: "FormConfigurationVersion",
                table: "permits");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "equipment");

            migrationBuilder.DropColumn(
                name: "Enabled",
                table: "equipment");

            migrationBuilder.DropColumn(
                name: "EquipmentType",
                table: "equipment");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "equipment");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "contractors");

            migrationBuilder.DropColumn(
                name: "Enabled",
                table: "contractors");

            migrationBuilder.DropColumn(
                name: "ShortName",
                table: "contractors");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "contractors");

            migrationBuilder.DropColumn(
                name: "Enabled",
                table: "areas");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "areas");
        }
    }
}
