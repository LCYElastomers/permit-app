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
            Body = new GeneralWorkBody { PermitType = "WELDING", CompanyType = "LCY" },
        };
        var result = session.Accept(rejected, Recorded);

        Assert.Equal(GeneralWorkResultKind.Invalid, result.Kind);
        Assert.Equal("permit-type-invalid", result.Error);
        Assert.Empty(session.Receipts);
        Assert.Empty(session.Permits);
    }

    [Theory]
    [InlineData(PermitType.GENERAL_WORK)]
    [InlineData(PermitType.HOT_WORK)]
    [InlineData(PermitType.CONFINED_SPACE)]
    [InlineData(PermitType.OPENING_BLINDING)]
    [InlineData(PermitType.EXCAVATION)]
    [InlineData(PermitType.LIVE_ELECTRICAL)]
    public void EachPermitTypeKeepsItsIdentityAndModuleFacts(PermitType type)
    {
        var session = new GeneralWorkSession();
        var push = Sample();
        push.Body!.PermitType = type.ToString();
        push.Body.ModuleFacts =
        [
            new ModuleFactInput { Module = "HOT_WORK", Name = "fireWatch", Value = "Alex Morgan" },
            new ModuleFactInput { Module = "EXCAVATION", Name = "depth", Value = "4 ft" },
            new ModuleFactInput { Module = "LOTO_ISOLATION", Name = "lockBox", Value = "LB-4" },
            new ModuleFactInput { Module = "ATMOSPHERIC_MONITORING", Name = "initialTest", Value = "O2 20.9" },
        ];
        var result = session.Accept(push, Recorded);

        Assert.Equal(GeneralWorkResultKind.Accepted, result.Kind);
        Assert.Equal(type, result.Plan!.Permit.PermitType);
        Assert.Equal(PermitId, result.PermitId);
        Assert.Contains(result.Plan.ModuleFacts, fact => fact.Name == "fireWatch" && fact.Value == "Alex Morgan" && fact.ModuleKind == PermitModuleKind.HOT_WORK);
        Assert.Contains(result.Plan.ModuleFacts, fact => fact.Name == "depth" && fact.Value == "4 ft");
        Assert.Contains(result.Plan.Modules, module => module.Kind == PermitModuleKind.CORE && module.Required);
        Assert.Contains(result.Plan.ModuleFacts, fact => fact.Name == "lockBox" && fact.Value == "LB-4");
        Assert.Contains(result.Plan.ModuleFacts, fact => fact.Name == "initialTest" && fact.Value == "O2 20.9");
        if (type == PermitType.HOT_WORK)
            Assert.Contains(result.Plan.Modules, module => module.Kind == PermitModuleKind.LOTO_ISOLATION);
        if (type is PermitType.EXCAVATION or PermitType.OPENING_BLINDING)
            Assert.Contains(result.Plan.Modules, module => module.Kind == PermitModuleKind.ATMOSPHERIC_MONITORING);
        if (type == PermitType.GENERAL_WORK)
            Assert.DoesNotContain(result.Plan.Modules, module => module.Kind == PermitModuleKind.HOT_WORK);
        if (type == PermitType.GENERAL_WORK)
        {
            Assert.Contains("general-work-facts", result.Plan.Event.Payload);
        }
        else
        {
            Assert.True(string.IsNullOrEmpty(result.Plan.Event.Payload));
        }
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

    [Fact]
    public void SubmissionBecomesPendingReviewAndKeepsTheClientClock()
    {
        var session = new GeneralWorkSession();
        var created = session.Accept(Sample(), Recorded);
        var occurred = Recorded.AddMinutes(-2);
        var user = Guid.Parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        var device = Guid.Parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        var submit = Submission(occurred, user, device);
        var result = session.Submit(submit, Recorded.AddMinutes(3));

        Assert.Equal(GeneralWorkResultKind.Accepted, result.Kind);
        Assert.Equal(created.PermitNumber, result.PermitNumber);
        Assert.Equal(PermitStatus.PENDING_REVIEW, session.Permits.Single().Status);
        var domainEvent = Assert.Single(session.Events, item => item.EventType == PermitEventType.PERMIT_SUBMITTED);
        Assert.Equal(occurred, domainEvent.OccurredAt);
        Assert.Equal(Recorded.AddMinutes(3), domainEvent.RecordedAt);
        Assert.Equal(user, domainEvent.UserId);
        Assert.Equal(device, domainEvent.DeviceId);
        Assert.Equal(Recorded.AddMinutes(3), session.Receipts.Single(item => item.EventType == PermitEventType.PERMIT_SUBMITTED).ReceivedAt);
        Assert.Single(session.Permits);

        var retry = session.Submit(submit, Recorded.AddMinutes(10));
        Assert.Equal(GeneralWorkResultKind.Duplicate, retry.Kind);
        Assert.Equal(created.PermitNumber, retry.PermitNumber);
        Assert.Single(session.Permits);
        Assert.Equal(2, session.Receipts.Count);
        Assert.Equal(2, session.Events.Count);
    }

    [Fact]
    public void SubmissionBeforeThePermitExistsDoesNotCreateOne()
    {
        var session = new GeneralWorkSession();
        var result = session.Submit(Submission(Recorded, null, null), Recorded);

        Assert.Equal(GeneralWorkResultKind.Conflict, result.Kind);
        Assert.Equal("permit-not-ready", result.Error);
        Assert.Empty(session.Permits);
        Assert.Empty(session.Receipts);
    }

    [Fact]
    public void SubmissionDoesNotRewindALaterStatus()
    {
        var session = new GeneralWorkSession();
        session.Accept(Sample(), Recorded);
        session.Permits.Single().Status = PermitStatus.AUTHORIZED;
        var result = session.Submit(Submission(Recorded, null, null), Recorded.AddMinutes(1));

        Assert.Equal(GeneralWorkResultKind.Conflict, result.Kind);
        Assert.Equal("lifecycle-conflict", result.Error);
        Assert.Equal(PermitStatus.AUTHORIZED, session.Permits.Single().Status);
        Assert.DoesNotContain(session.Events, item => item.EventType == PermitEventType.PERMIT_SUBMITTED);
    }

    [Fact]
    public void AnotherWorkstationCanSeeTheSubmittedPermitByStatus()
    {
        var session = new GeneralWorkSession();
        session.Accept(Sample(), Recorded);
        var result = session.Submit(Submission(Recorded.AddMinutes(-1), null, null), Recorded);
        var visible = session.Permits.Where(item => item.Status == PermitStatus.PENDING_REVIEW).ToList();

        Assert.Equal(GeneralWorkResultKind.Accepted, result.Kind);
        Assert.Single(visible);
        Assert.Equal(result.PermitNumber, visible[0].PermitNumber);
        Assert.Equal(PermitStatus.PENDING_REVIEW, visible[0].Status);
    }

    private static GeneralWorkPush Submission(DateTimeOffset occurredAt, Guid? userId, Guid? deviceId) => new()
    {
        EventId = Guid.Parse("99999999-9999-4999-8999-999999999999"),
        PermitId = PermitId,
        Revision = 1,
        EventType = nameof(PermitEventType.PERMIT_SUBMITTED),
        OccurredAt = occurredAt,
        UserId = userId,
        DeviceId = deviceId,
    };

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
