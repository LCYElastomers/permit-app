using Microsoft.AspNetCore.Mvc;
using PermitControl.Application;
using PermitControl.Domain;

namespace PermitControl.Api.Controllers;

[ApiController]
[Route("api/v1/health")]
public sealed class HealthController(IDatabaseAvailability database, IDatabaseProbe probe) : ControllerBase
{
    [HttpGet]
    public ActionResult<HealthResponse> Get() =>
        Ok(new HealthResponse("ok", "permit-control-api", database.IsConfigured));

    [HttpGet("ready")]
    public async Task<ActionResult<ReadinessResponse>> Ready(CancellationToken cancellationToken)
    {
        if (!database.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ReadinessResponse("not-ready"));
        }

        var ready = await probe.CanQueryAsync(cancellationToken);
        return ready
            ? Ok(new ReadinessResponse("ready"))
            : StatusCode(StatusCodes.Status503ServiceUnavailable, new ReadinessResponse("not-ready"));
    }
}

[ApiController]
[Route("api/v1/permits")]
public sealed class PermitsController(IDatabaseAvailability database) : ControllerBase
{
    [HttpPost]
    public ActionResult<PermitSummary> Create([FromBody] CreatePermitRequest request)
    {
        if (request.Id == Guid.Empty || string.IsNullOrWhiteSpace(request.PermitNumber) || string.IsNullOrWhiteSpace(request.JobDescription))
        {
            return BadRequest(new { error = "id, permitNumber, and jobDescription are required" });
        }

        return DatabaseOr<PermitSummary>();
    }

    private ActionResult<T> DatabaseOr<T>()
    {
        if (!database.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        }

        return StatusCode(StatusCodes.Status501NotImplemented, new { error = "not-implemented" });
    }
}

[ApiController]
[Route("api/v1")]
public sealed class ReferenceController(IDatabaseAvailability database) : ControllerBase
{
    [HttpGet("equipment")]
    public IActionResult Equipment() => UnavailableOrNotImplemented();

    [HttpGet("contractors")]
    public IActionResult Contractors() => UnavailableOrNotImplemented();

    [HttpGet("archive")]
    public IActionResult Archive() => UnavailableOrNotImplemented();

    [HttpGet("archive/{id:guid}")]
    public IActionResult ArchiveItem(Guid id) => UnavailableOrNotImplemented();

    private IActionResult UnavailableOrNotImplemented()
    {
        if (!database.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        }

        return StatusCode(StatusCodes.Status501NotImplemented, new { error = "not-implemented" });
    }
}

[ApiController]
[Route("api/v1/sync")]
public sealed class SyncController(IDatabaseAvailability database, IGeneralWorkSync sync) : ControllerBase
{
    [HttpPost("push")]
    public async Task<IActionResult> Push([FromBody] SyncPushRequest? request, CancellationToken cancellationToken)
    {
        if (request?.Events is null || request.Events.Count == 0)
        {
            return BadRequest(new { error = "events is required" });
        }

        if (request.Events.Count != 1)
        {
            return BadRequest(new { error = "single-event-required" });
        }

        if (!database.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        }

        try
        {
            var result = await sync.PushAsync(ToPush(request.Events[0]), cancellationToken);
            return result.Kind switch
            {
                GeneralWorkResultKind.Accepted or GeneralWorkResultKind.Duplicate => Ok(new SyncPushResponse(
                [
                    new SyncAcknowledgement(result.EventId, result.PermitId, result.PermitNumber ?? "", result.Revision, result.Kind == GeneralWorkResultKind.Duplicate ? "duplicate" : "accepted"),
                ])),
                GeneralWorkResultKind.Conflict => Conflict(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error }),
            };
        }
        catch (DatabaseUnavailableException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-unavailable" });
        }
    }

    private static GeneralWorkPush ToPush(SyncPushEvent source)
    {
        var permit = source.Permit;
        return new GeneralWorkPush
        {
            EventId = source.Id,
            PermitId = source.PermitId,
            Revision = source.PermitRevision,
            EventType = source.EventType ?? "",
            OccurredAt = source.OccurredAt,
            UserId = source.UserId,
            DeviceId = source.DeviceId,
            Body = permit is null
                ? null
                : new GeneralWorkBody
                {
                    PermitType = permit.PermitType ?? "",
                    AreaId = permit.AreaId,
                    AreaName = permit.AreaName,
                    EquipmentTag = permit.EquipmentTag,
                    WorkOrder = permit.WorkOrder,
                    JobDescription = permit.JobDescription,
                    CompanyType = permit.CompanyType,
                    CompanyName = permit.CompanyName,
                    Requester = permit.Requester,
                    Craft = permit.Craft,
                    PlannedStartClock = permit.PlannedStartClock,
                    PlannedExpirationClock = permit.PlannedExpirationClock,
                    Hazards = permit.Hazards,
                    Controls = permit.Controls,
                    Ppe = permit.Ppe,
                    TaskType = permit.TaskType,
                    EquipmentSystem = permit.EquipmentSystem,
                    ServiceProcess = permit.ServiceProcess,
                    MaterialInService = permit.MaterialInService,
                    Coordination = permit.Coordination,
                    HeightControls = permit.HeightControls,
                    Exclusions = permit.Exclusions,
                },
        };
    }

    [HttpGet("pull")]
    public IActionResult Pull([FromQuery] DateTimeOffset? since) =>
        StatusCode(StatusCodes.Status501NotImplemented, new { error = "sync-not-implemented", since });
}
