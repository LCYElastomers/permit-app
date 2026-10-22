using PermitControl.Domain;

namespace PermitControl.Domain.Tests;

public sealed class SafetyTransitionTests
{
    private static readonly DateTimeOffset SuspendedAt = new(2026, 10, 21, 19, 7, 0, TimeSpan.Zero);

    [Fact]
    public void Older_activation_does_not_clear_a_suspension()
    {
        var outcome = SafetyTransitions.Evaluate(
            PermitStatus.SUSPENDED,
            SuspendedAt,
            PermitEventType.ACTIVATED,
            SuspendedAt.AddMinutes(-30));

        Assert.Equal(TransitionOutcome.RejectedStale, outcome);
    }

    [Fact]
    public void Activation_while_suspended_requires_an_explicit_reauthorization()
    {
        var outcome = SafetyTransitions.Evaluate(
            PermitStatus.SUSPENDED,
            SuspendedAt,
            PermitEventType.ACTIVATED,
            SuspendedAt.AddMinutes(10));

        Assert.Equal(TransitionOutcome.RejectedStale, outcome);
    }

    [Fact]
    public void Reauthorization_after_suspension_is_accepted()
    {
        var outcome = SafetyTransitions.Evaluate(
            PermitStatus.SUSPENDED,
            SuspendedAt,
            PermitEventType.REAUTHORIZED,
            SuspendedAt.AddMinutes(5));

        Assert.Equal(TransitionOutcome.Applied, outcome);
    }

    [Fact]
    public void Closed_permit_does_not_reopen()
    {
        var outcome = SafetyTransitions.Evaluate(
            PermitStatus.CLOSED,
            SuspendedAt,
            PermitEventType.ACTIVATED,
            SuspendedAt.AddHours(1));

        Assert.Equal(TransitionOutcome.RejectedTerminal, outcome);
    }

    [Theory]
    [InlineData(PermitStatus.CANCELLED)]
    [InlineData(PermitStatus.EXPIRED)]
    [InlineData(PermitStatus.SUPERSEDED)]
    public void Finished_states_do_not_reactivate(PermitStatus status)
    {
        var outcome = SafetyTransitions.Evaluate(status, SuspendedAt, PermitEventType.REAUTHORIZED, SuspendedAt.AddMinutes(1));
        Assert.Equal(TransitionOutcome.RejectedTerminal, outcome);
    }
}

public sealed class PermitSyncStateTests
{
    [Fact]
    public void Repeated_event_id_is_a_duplicate()
    {
        var state = new PermitSyncState(PermitStatus.ACTIVE, DateTimeOffset.UnixEpoch);
        var id = Guid.NewGuid();
        var incoming = new IncomingPermitEvent(id, PermitEventType.SUSPENDED, DateTimeOffset.UnixEpoch.AddHours(1));

        Assert.Equal(ApplyResult.Applied, state.Apply(incoming));
        Assert.Equal(PermitStatus.SUSPENDED, state.Status);
        Assert.Equal(ApplyResult.Duplicate, state.Apply(incoming));
        Assert.Equal(PermitStatus.SUSPENDED, state.Status);
    }

    [Fact]
    public void Stale_activation_is_recorded_without_changing_status()
    {
        var suspendedAt = new DateTimeOffset(2026, 10, 21, 19, 0, 0, TimeSpan.Zero);
        var state = new PermitSyncState(PermitStatus.SUSPENDED, suspendedAt);
        var result = state.Apply(new IncomingPermitEvent(Guid.NewGuid(), PermitEventType.ACTIVATED, suspendedAt.AddMinutes(-5)));

        Assert.Equal(ApplyResult.RejectedStale, result);
        Assert.Equal(PermitStatus.SUSPENDED, state.Status);
    }
}

public sealed class GeneralWorkAdvisorTests
{
    [Fact]
    public void Incompatible_scope_recommends_another_classification()
    {
        var advisor = new GeneralWorkModuleAdvisor();
        var recommendations = advisor.Recommend(
            PermitType.GENERAL_WORK,
            new ScopeSignal(ProcessOpening: true, ContainmentBreak: false, ConfinedSpaceEntry: false, EnergyIsolation: false, HotWork: true));

        Assert.Contains(recommendations, item => item.PermitType == PermitType.OPENING_BLINDING);
        Assert.Contains(recommendations, item => item.PermitType == PermitType.HOT_WORK);
    }

    [Fact]
    public void Other_classifications_are_left_alone()
    {
        var advisor = new GeneralWorkModuleAdvisor();
        var recommendations = advisor.Recommend(PermitType.HOT_WORK, new ScopeSignal(true, true, true, true, true));
        Assert.Empty(recommendations);
    }
}
