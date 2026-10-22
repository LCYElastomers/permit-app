using System.Text.Json;
using PermitControl.Domain;
using PermitControl.Infrastructure.Documents;

namespace PermitControl.Domain.Tests;

public class PermitPdfTests
{
    private static readonly DateTimeOffset GeneratedAt = new(2026, 10, 22, 20, 15, 0, TimeSpan.Zero);

    [Fact]
    public void Draft_document_states_that_work_is_not_authorized()
    {
        var document = GeneralWorkDocuments.Compose(Sample(), Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), GeneratedAt);

        Assert.Contains("LCY PERMIT CONTROL", document.Banner);
        Assert.Contains("GENERAL WORK PERMIT", document.Banner);
        Assert.True(document.Contains("DRAFT"));
        Assert.True(document.Contains("NOT AUTHORIZED FOR WORK"));
        Assert.True(document.Contains("PTW-2026-00001"));
        Assert.True(document.Contains(SamplePermitId.ToString("D")));
        Assert.True(document.Contains("Revision: 1"));
        Assert.True(document.Contains("Lifecycle status: DRAFT"));
        Assert.True(document.Contains("Line break"));
        Assert.True(document.Contains("Gas monitor"));
        Assert.True(document.Contains("Hard hat"));
        Assert.True(document.Contains("Long chemical suit"));
        Assert.True(document.Contains("Replace the local pressure gauge"));
        Assert.True(document.Contains("Unit 2"));
        Assert.True(document.Contains("P-418"));
        Assert.True(document.Contains("WO-104583"));
        Assert.True(document.Contains("Process opening: excluded"));
        Assert.True(document.Contains("Working at height: Scaffold"));
        Assert.True(document.Contains("15:00"));
        Assert.Contains("GENERAL INFORMATION", document.Sections.Select(section => section.Title));
        Assert.Contains("WORK SCOPE", document.Sections.Select(section => section.Title));
        Assert.Contains("HAZARDS", document.Sections.Select(section => section.Title));
        Assert.Contains("CONTROLS", document.Sections.Select(section => section.Title));
        Assert.Contains("PPE", document.Sections.Select(section => section.Title));
        Assert.Contains("GENERAL WORK CONDITIONS", document.Sections.Select(section => section.Title));
    }

    [Fact]
    public void Renderer_writes_a_pdf_that_contains_the_draft_notice_and_permit_number()
    {
        var document = GeneralWorkDocuments.Compose(Sample(), Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), GeneratedAt);
        var bytes = new PdfSharpPermitRenderer().Render(document);
        var text = System.Text.Encoding.Latin1.GetString(bytes);

        Assert.True(bytes.Length > 5);
        Assert.Equal((byte)'%', bytes[0]);
        Assert.StartsWith("%PDF-", text);
        Assert.Contains("NOT AUTHORIZED FOR WORK", text);
        Assert.Contains("DRAFT", text);
        Assert.Contains("PTW-2026-00001", text);
        Assert.Contains(SamplePermitId.ToString("D"), text);
        Assert.Contains("Revision: 1", text);
        Assert.Contains("Line break", text);
        Assert.Contains("Gas monitor", text);
        Assert.Contains("Hard hat", text);
        Assert.Contains("Process opening: excluded", text);
    }

    [Fact]
    public void Prepare_hashes_the_pdf_bytes_and_hides_the_storage_key()
    {
        var exportId = Guid.Parse("11111111-2222-3333-4444-555555555555");
        var prepared = PermitPdfExporting.Prepare(Sample(), PermitExportType.PRINT, exportId, GeneratedAt, new PdfSharpPermitRenderer().Render);

        Assert.Equal(PermitPdfKind.Ready, prepared.Kind);
        Assert.Equal(PermitExportKeys.Sha256Hex(prepared.Content!), prepared.Export!.Sha256);
        Assert.Equal(PermitExportKeys.Generated(SamplePermitId, exportId), prepared.Export.StorageKey);
        Assert.Equal("PTW-2026-00001-General-Work-Rev-01.pdf", prepared.Receipt!.Filename);
        var json = JsonSerializer.Serialize(prepared.Receipt);
        Assert.DoesNotContain("exports/generated", json);
        Assert.DoesNotContain("/srv", json);
        Assert.DoesNotContain("StorageKey", json);
        Assert.Null(prepared.Export.GeneratedBy);
    }

    [Fact]
    public void A_second_generation_uses_a_new_export_and_does_not_reuse_the_file()
    {
        var files = new Dictionary<string, byte[]>();
        var records = new List<PermitExport>();
        var renderer = new PdfSharpPermitRenderer();
        foreach (var exportId in new[] { Guid.NewGuid(), Guid.NewGuid() })
        {
            var prepared = PermitPdfExporting.Prepare(Sample(), PermitExportType.SNAPSHOT, exportId, GeneratedAt, renderer.Render);
            Assert.False(files.ContainsKey(prepared.Export!.StorageKey));
            files[prepared.Export.StorageKey] = prepared.Content!;
            records.Add(prepared.Export);
        }

        Assert.Equal(2, records.Count);
        Assert.Equal(2, files.Count);
        Assert.NotEqual(records[0].Id, records[1].Id);
        Assert.NotEqual(records[0].StorageKey, records[1].StorageKey);
        Assert.NotEqual(records[0].Sha256, records[1].Sha256);
    }

    [Fact]
    public void Unknown_permit_is_not_found_and_final_archive_is_refused()
    {
        var missing = PermitPdfExporting.Prepare(null, PermitExportType.PRINT, Guid.NewGuid(), GeneratedAt, _ => [1]);
        Assert.Equal(PermitPdfKind.NotFound, missing.Kind);

        var archive = PermitPdfExporting.Prepare(Sample(), PermitExportType.FINAL_ARCHIVE, Guid.NewGuid(), GeneratedAt, _ => [1]);
        Assert.Equal(PermitPdfKind.Invalid, archive.Kind);
        Assert.Equal("final-archive-not-available", archive.Error);
    }

    private static readonly Guid SamplePermitId = Guid.Parse("0b6d1a22-1111-4a1b-9c1d-111111111111");

    private static AuthoritativeGeneralWork Sample() => new()
    {
        Permit = new Permit
        {
            Id = SamplePermitId,
            PermitNumber = "PTW-2026-00001",
            PermitType = PermitType.GENERAL_WORK,
            Status = PermitStatus.DRAFT,
            WorkOrder = "WO-104583",
            JobDescription = "Replace the local pressure gauge",
            CompanyType = CompanyType.CONTRACTOR,
            CurrentRevision = 1,
        },
        AreaName = "Unit 2",
        EquipmentTag = "P-418",
        CompanyName = "Gulf Mechanical",
        Hazards = [new PermitHazard { Label = "Line break" }],
        Controls = [new PermitControlRecord { Label = "Gas monitor" }],
        Ppe = [new PermitPpe { Label = "Hard hat" }],
        Modules =
        [
            new PermitModule { Kind = PermitModuleKind.CORE, Required = true },
            new PermitModule { Kind = PermitModuleKind.HAZARD_ASSESSMENT },
            new PermitModule { Kind = PermitModuleKind.PPE },
            new PermitModule { Kind = PermitModuleKind.WORKING_AT_HEIGHT },
        ],
        Participants =
        [
            new PermitParticipant { RoleName = "Requester", DisplayName = "Alex Morgan" },
            new PermitParticipant { RoleName = "Craft / Permit Receiver", DisplayName = "Jordan Lee" },
        ],
        CreationFactsJson = """
            {
              "kind": "general-work-facts",
              "areaName": "Unit 2",
              "equipmentTag": "P-418",
              "companyName": "Gulf Mechanical",
              "plannedStartClock": "15:00",
              "plannedExpirationClock": "19:00",
              "taskType": "Gauge replacement",
              "equipmentSystem": "Cooling water",
              "serviceProcess": "Cooling",
              "materialInService": "Water",
              "coordination": "Operations notified",
              "heightControls": "Scaffold",
              "ppeText": ["Long chemical suit"],
              "exclusions": { "excludeOpening": "excluded" }
            }
            """,
    };
}
