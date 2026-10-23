using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PermitControl.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PermitModuleFacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "permit_module_facts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PermitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permit_module_facts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_permit_module_facts_permits_PermitId",
                        column: x => x.PermitId,
                        principalTable: "permits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_permit_module_facts_PermitId_ModuleKind_Name",
                table: "permit_module_facts",
                columns: new[] { "PermitId", "ModuleKind", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "permit_module_facts");
        }
    }
}
