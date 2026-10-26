namespace PermitControl.Domain;

public enum TransitionOutcome
{
    Applied,
    RejectedStale,
    RejectedTerminal,
}

/// <summary>
/// Explicit safety-state rules for a future sync engine.
/// A later event must not loosen a hold or reopen a finished permit.
/// </summary>
public static class SafetyTransitions
{
    public static bool IsTerminal(PermitStatus status) =>
        status is PermitStatus.CLOSED
            or PermitStatus.CANCELLED
            or PermitStatus.EXPIRED
            or PermitStatus.SUPERSEDED;

    public static bool WouldActivate(PermitEventType type) =>
        type is PermitEventType.ACTIVATED or PermitEventType.AUTHORIZED or PermitEventType.ACCEPTED;

    public static TransitionOutcome Evaluate(
        PermitStatus current,
        DateTimeOffset currentStateAt,
        PermitEventType incoming,
        DateTimeOffset incomingOccurredAt)
    {
        if (IsTerminal(current) && (WouldActivate(incoming) || incoming == PermitEventType.REAUTHORIZED))
        {
            return TransitionOutcome.RejectedTerminal;
        }

        if (current == PermitStatus.SUSPENDED && WouldActivate(incoming))
        {
            return TransitionOutcome.RejectedStale;
        }

        if (current == PermitStatus.SUSPENDED
            && incoming == PermitEventType.REAUTHORIZED
            && incomingOccurredAt < currentStateAt)
        {
            return TransitionOutcome.RejectedStale;
        }

        return TransitionOutcome.Applied;
    }
}

public sealed record IncomingPermitEvent(Guid Id, PermitEventType Type, DateTimeOffset OccurredAt);

public enum ApplyResult
{
    Applied,
    Duplicate,
    RejectedStale,
    RejectedTerminal,
}

/// <summary>
/// In-memory stand-in for the future outbox applicator.
/// Event ids are idempotent. Safety transitions are not last-write-wins.
/// </summary>
public sealed class PermitSyncState
{
    private readonly HashSet<Guid> _processed = [];

    public PermitSyncState(PermitStatus status, DateTimeOffset stateAt)
    {
        Status = status;
        StateAt = stateAt;
    }

    public PermitStatus Status { get; private set; }
    public DateTimeOffset StateAt { get; private set; }

    public ApplyResult Apply(IncomingPermitEvent incoming)
    {
        if (!_processed.Add(incoming.Id))
        {
            return ApplyResult.Duplicate;
        }

        var outcome = SafetyTransitions.Evaluate(Status, StateAt, incoming.Type, incoming.OccurredAt);
        if (outcome == TransitionOutcome.RejectedStale)
        {
            return ApplyResult.RejectedStale;
        }

        if (outcome == TransitionOutcome.RejectedTerminal)
        {
            return ApplyResult.RejectedTerminal;
        }

        Status = ApplyStatus(Status, incoming.Type);
        if (incoming.OccurredAt > StateAt)
        {
            StateAt = incoming.OccurredAt;
        }

        return ApplyResult.Applied;
    }

    private static PermitStatus ApplyStatus(PermitStatus current, PermitEventType type) => type switch
    {
        PermitEventType.SUBMITTED => PermitStatus.PENDING_REVIEW,
        PermitEventType.AUTHORIZED or PermitEventType.ACCEPTED => PermitStatus.AUTHORIZED,
        PermitEventType.ACTIVATED => PermitStatus.ACTIVE,
        PermitEventType.SUSPENDED => PermitStatus.SUSPENDED,
        PermitEventType.REAUTHORIZED => current == PermitStatus.SUSPENDED ? PermitStatus.AUTHORIZED : current,
        PermitEventType.PERMIT_RETURNED_FOR_CORRECTION => PermitStatus.PENDING_REVIEW,
        PermitEventType.CLOSED => PermitStatus.CLOSED,
        _ => current,
    };
}
