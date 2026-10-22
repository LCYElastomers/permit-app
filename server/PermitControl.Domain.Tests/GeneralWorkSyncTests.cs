using System.Collections.Concurrent;
using PermitControl.Domain;

namespace PermitControl.Domain.Tests;

public sealed class GeneralWorkSyncTests
{
    private static readonly DateTimeOffset Recorded = new(2026, 10, 22, 18, 0, 0, TimeSpan.Zero);
    private static readonly Guid PermitId = Guid.Parse("44444444-4444-4444-8444-111111111111");
    private static readonly Guid EventId = Guid.Parse("55555555-5555-4555-8555-111111111111");
    private static readonly Guid AreaId = Guid.Parse("0b6d1a22-1111-4a1b-9c1d-111111111111");

    [Fact]
    public void FirstAcceptancePreservesClientIdentityAndWritesTheReceipt()
    {
        var session = new GeneralWorkSession();
        var result = session.Accept(Sample(), Recorded);

        Assert.Equal(GeneralWorkResultKind.Accepted, result.Kind);
        Assert.Equal(PermitId, result.PermitId);
        Assert.Equal(EventId, result.EventId);
        Assert.Equal("PTW-2026-00001", result.PermitNumber);
        Assert.Equal(PermitStatus.DRAFT, result.Plan!.Permit.Status);
        Assert.Equal(PermitType.GENERAL_WORK, result.Plan.Permit.PermitType);
        Assert.Equal(AreaId, result.Plan.Permit.AreaId);
        Assert.Equal(EventId, result.Plan.Event.Id);
        Assert.Equal(EventId, result.Plan.Receipt.Id);
        Assert.Equal(PermitId, result.Plan.Receipt.PermitId);
        Assert.Single(session.Permits);
        Assert.Single(session.Events);
        Assert.Single(session.Receipts);
        Assert.Single(session.Revisions);
        Assert.Contains("P-210", result.Plan.Event.Payload);
        Assert.Contains("Gauge glass", result.Plan.Permit.JobDescription);
    }

    [Fact]
    public void FailedCommitRollsBackPermitEventReceiptAndNumber()
    {
        var session = new GeneralWorkSession();
        Assert.Throws<InvalidOperationException>(() => session.Accept(Sample(), Recorded, failBeforeCommit: true));
        Assert.Empty(session.Permits);
        Assert.Empty(session.Events);
        Assert.Empty(session.Receipts);
        Assert.Empty(session.Revisions);

        var result = session.Accept(Sample(), Recorded);
        Assert.Equal("PTW-2026-00001", result.PermitNumber);
    }

    [Fact]
    public void RetryReturnsTheSamePermitNumberAndDoesNotCreateAnotherPermit()
    {
        var session = new GeneralWorkSession();
        var first = session.Accept(Sample(), Recorded);
        var second = session.Accept(Sample(), Recorded.AddMinutes(5));

        Assert.Equal(GeneralWorkResultKind.Duplicate, second.Kind);
        Assert.Equal(first.PermitNumber, second.PermitNumber);
        Assert.Equal(PermitId, second.PermitId);
        Assert.Equal(EventId, second.EventId);
        Assert.Single(session.Permits);
        Assert.Single(session.Receipts);
    }

    [Fact]
    public void ValidationFailureDoesNotWriteAReceipt()
    {
        var session = new GeneralWorkSession();
        var push = Sample();
        var rejected = new GeneralWorkPush
        {
            EventId = push.EventId,
            PermitId = push.PermitId,
            Revision = push.Revision,
            EventType = push.EventType,
            OccurredAt = push.OccurredAt,
            Body = new GeneralWorkBody { PermitType = "HOT_WORK", CompanyType = "LCY" },
        };
        var result = session.Accept(rejected, Recorded);

        Assert.Equal(GeneralWorkResultKind.Invalid, result.Kind);
        Assert.Equal("permit-type-invalid", result.Error);
        Assert.Empty(session.Receipts);
        Assert.Empty(session.Permits);
    }

    [Fact]
    public void ConcurrentNumbersStayUnique()
    {
        var allocator = new PermitNumberAllocator();
        var numbers = new ConcurrentBag<string>();
        Parallel.For(0, 200, _ => numbers.Add(allocator.Allocate(2026)));
        Assert.Equal(200, numbers.Distinct().Count());
        Assert.Contains("PTW-2026-00001", numbers);
        Assert.Contains("PTW-2026-00200", numbers);
    }

    [Fact]
    public void NumberSqlAllocatesInsideTheCounterRow()
    {
        Assert.Contains("ON CONFLICT (\"Year\")", PermitNumberSql.Allocate, StringComparison.Ordinal);
        Assert.Contains("RETURNING \"LastValue\"", PermitNumberSql.Allocate, StringComparison.Ordinal);
    }

    private static GeneralWorkPush Sample() => new()
    {
        EventId = EventId,
        PermitId = PermitId,
        Revision = 1,
        EventType = "PERMIT_CREATED",
        OccurredAt = Recorded.AddMinutes(-2),
        Body = new GeneralWorkBody
        {
            PermitType = "GENERAL_WORK",
            AreaId = AreaId,
            AreaName = "Unit 2",
            EquipmentTag = "P-210",
            WorkOrder = "WO-104700",
            JobDescription = "Gauge glass inspection",
            CompanyType = "CONTRACTOR",
            CompanyName = "Gulf Industrial Services",
            Requester = "Elena Voss",
            Craft = "Jordan Peck",
            PlannedStartClock = "15:00",
            PlannedExpirationClock = "19:00",
            Hazards = ["slip/trip"],
            Controls = ["barricade"],
            Ppe = ["Gloves"],
            TaskType = "Inspection",
            Exclusions = new Dictionary<string, string> { ["excludeOpening"] = "excluded" },
        },
    };
}
