using System.Text;
using System.Text.Json;
using PdfSharp.Pdf.IO;
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

    [Theory]
    [InlineData(PermitStatus.DRAFT, "DRAFT", "NOT AUTHORIZED FOR WORK")]
    [InlineData(PermitStatus.PENDING_REVIEW, "PENDING REVIEW", "NOT AUTHORIZED FOR WORK")]
    [InlineData(PermitStatus.AUTHORIZED, "AUTHORIZED", "NOT ACTIVE FOR WORK")]
    [InlineData(PermitStatus.ACTIVE, "ACTIVE", "WORK AUTHORIZED")]
    [InlineData(PermitStatus.SUSPENDED, "SUSPENDED", "WORK NOT AUTHORIZED")]
    [InlineData(PermitStatus.EXPIRED, "EXPIRED", "WORK NOT AUTHORIZED")]
    [InlineData(PermitStatus.CANCELLED, "CANCELLED", "WORK NOT AUTHORIZED")]
    [InlineData(PermitStatus.CLOSED, "CLOSED", "HISTORICAL RECORD")]
    [InlineData(PermitStatus.SUPERSEDED, "SUPERSEDED", "NOT CURRENT")]
    public void Only_active_renders_work_authorized(PermitStatus status, string heading, string authority)
    {
        var document = GeneralWorkDocuments.Compose(Sample(status), Guid.NewGuid(), GeneratedAt);

        Assert.Contains(heading, document.Banner);
        Assert.Contains(authority, document.Banner);
        Assert.Equal(status == PermitStatus.ACTIVE, document.Contains("WORK AUTHORIZED"));
        if (status != PermitStatus.ACTIVE)
        {
            Assert.DoesNotContain("WORK AUTHORIZED", document.Banner);
            Assert.DoesNotContain(document.Sections.SelectMany(section => section.Lines), line => line.Contains("WORK AUTHORIZED", StringComparison.Ordinal));
        }
    }

    [Fact]
    public void Unknown_status_is_not_authorizing()
    {
        var document = GeneralWorkDocuments.Compose(Sample((PermitStatus)42), Guid.NewGuid(), GeneratedAt);

        Assert.Contains("UNRECOGNIZED STATUS", document.Banner);
        Assert.Contains("NOT AUTHORIZED FOR WORK", document.Banner);
        Assert.False(document.Contains("WORK AUTHORIZED"));
        var prepared = PermitPdfExporting.Prepare(Sample((PermitStatus)42), PermitExportType.PRINT, Guid.NewGuid(), GeneratedAt, _ => [0x25, 0x50, 0x44, 0x46]);
        Assert.Equal("UNRECOGNIZED", prepared.Export!.DocumentClassification);
    }

    [Fact]
    public void Active_document_includes_the_authoritative_general_work_record()
    {
        var source = Sample(PermitStatus.ACTIVE);
        source.Permit.PlannedStart = new DateTimeOffset(2026, 10, 22, 20, 0, 0, TimeSpan.Zero);
        source.Permit.ExpiresAt = new DateTimeOffset(2026, 10, 23, 0, 0, 0, TimeSpan.Zero);
        source.Permit.ActivatedAt = new DateTimeOffset(2026, 10, 22, 20, 5, 0, TimeSpan.Zero);
        var document = GeneralWorkDocuments.Compose(source, Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), GeneratedAt);

        Assert.Contains("ACTIVE", document.Banner);
        Assert.Contains("WORK AUTHORIZED", document.Banner);
        Assert.True(document.Contains("PTW-2026-00001"));
        Assert.True(document.Contains(SamplePermitId.ToString("D")));
        Assert.True(document.Contains("Revision: 1"));
        Assert.True(document.Contains("GENERAL_WORK"));
        Assert.True(document.Contains("Unit 2"));
        Assert.True(document.Contains("P-418"));
        Assert.True(document.Contains("WO-104583"));
        Assert.True(document.Contains("Replace the local pressure gauge"));
        Assert.True(document.Contains("Gulf Mechanical"));
        Assert.True(document.Contains("Alex Morgan"));
        Assert.True(document.Contains("Jordan Lee"));
        Assert.True(document.Contains("15:00"));
        Assert.True(document.Contains("19:00"));
        Assert.True(document.Contains("2026-10-22 20:00:00 UTC"));
        Assert.True(document.Contains("2026-10-23 00:00:00 UTC"));
        Assert.True(document.Contains("2026-10-22 20:05:00 UTC"));
        Assert.True(document.Contains("Line break"));
        Assert.True(document.Contains("Gas monitor"));
        Assert.True(document.Contains("Hard hat"));
        Assert.True(document.Contains("Process opening: excluded"));
        Assert.True(document.Contains("WORKING_AT_HEIGHT"));
        Assert.True(document.Contains("2026-10-22 20:15:00 UTC"));
        Assert.DoesNotContain(document.Banner, line => line.Contains("signature", StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData(PermitStatus.SUSPENDED, "SUSPENDED", "WORK NOT AUTHORIZED")]
    [InlineData(PermitStatus.ACTIVE, "ACTIVE", "WORK AUTHORIZED")]
    [InlineData(PermitStatus.DRAFT, "DRAFT", "NOT AUTHORIZED FOR WORK")]
    [InlineData(PermitStatus.PENDING_REVIEW, "PENDING REVIEW", "NOT AUTHORIZED FOR WORK")]
    [InlineData(PermitStatus.CANCELLED, "CANCELLED", "WORK NOT AUTHORIZED")]
    [InlineData(PermitStatus.SUPERSEDED, "SUPERSEDED", "NOT CURRENT")]
    [InlineData(PermitStatus.EXPIRED, "EXPIRED", "WORK NOT AUTHORIZED")]
    public void Later_pages_repeat_identity_and_do_not_authorize_other_statuses(PermitStatus status, string heading, string authority)
    {
        var hazards = Enumerable.Range(1, 80).Select(index => new PermitHazard { Label = $"Hazard line {index:00} for page break" }).ToArray();
        var bytes = new PdfSharpPermitRenderer().Render(GeneralWorkDocuments.Compose(Sample(status, hazards), Guid.NewGuid(), GeneratedAt));
        using var stream = new MemoryStream(bytes);
        var pdf = PdfReader.Open(stream, PdfDocumentOpenMode.Import);
        Assert.True(pdf.PageCount >= 2);
        var later = PageText(pdf.Pages[1]);

        Assert.Contains("PTW-2026-00001", later);
        Assert.Contains("Revision: 1", later);
        Assert.Contains(heading, later);
        Assert.Contains(authority, later);
        Assert.Contains("Page 2", later);
        Assert.Equal(status == PermitStatus.ACTIVE, later.Contains("WORK AUTHORIZED", StringComparison.Ordinal));
    }

    [Fact]
    public void Active_then_suspended_exports_stay_separate()
    {
        var files = new Dictionary<string, byte[]>();
        var renderer = new PdfSharpPermitRenderer();
        var active = PermitPdfExporting.Prepare(Sample(PermitStatus.ACTIVE), PermitExportType.PRINT, Guid.NewGuid(), GeneratedAt, renderer.Render);
        files[active.Export!.StorageKey] = active.Content!.ToArray();
        var activeBytes = files[active.Export.StorageKey].ToArray();
        var suspended = PermitPdfExporting.Prepare(Sample(PermitStatus.SUSPENDED), PermitExportType.PRINT, Guid.NewGuid(), GeneratedAt.AddMinutes(5), renderer.Render);
        Assert.False(files.ContainsKey(suspended.Export!.StorageKey));
        files[suspended.Export.StorageKey] = suspended.Content!;

        Assert.NotEqual(active.Export.Id, suspended.Export.Id);
        Assert.NotEqual(active.Export.StorageKey, suspended.Export.StorageKey);
        Assert.NotEqual(active.Export.Sha256, suspended.Export.Sha256);
        Assert.Equal(PermitExportKeys.Sha256Hex(activeBytes), active.Export.Sha256);
        Assert.Equal(activeBytes, files[active.Export.StorageKey]);
        Assert.Equal("ACTIVE", active.Export.DocumentClassification);
        Assert.Equal(1, active.Export.PermitRevision);
        Assert.Equal("SUSPENDED", suspended.Export.DocumentClassification);
        Assert.Equal(1, suspended.Export.PermitRevision);
        Assert.Contains("WORK AUTHORIZED", Encoding.Latin1.GetString(active.Content));
        Assert.DoesNotContain("WORK AUTHORIZED", Encoding.Latin1.GetString(suspended.Content));
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

    private static string PageText(PdfSharp.Pdf.PdfPage page)
    {
        var content = page.Contents.CreateSingleContent();
        return Encoding.Latin1.GetString(content.Stream.UnfilteredValue);
    }

    private static AuthoritativeGeneralWork Sample(PermitStatus status = PermitStatus.DRAFT, IReadOnlyList<PermitHazard>? hazards = null) => new()
    {
        Permit = new Permit
        {
            Id = SamplePermitId,
            PermitNumber = "PTW-2026-00001",
            PermitType = PermitType.GENERAL_WORK,
            Status = status,
            WorkOrder = "WO-104583",
            JobDescription = "Replace the local pressure gauge",
            CompanyType = CompanyType.CONTRACTOR,
            CurrentRevision = 1,
        },
        AreaName = "Unit 2",
        EquipmentTag = "P-418",
        CompanyName = "Gulf Mechanical",
        Hazards = hazards ?? [new PermitHazard { Label = "Line break" }],
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
