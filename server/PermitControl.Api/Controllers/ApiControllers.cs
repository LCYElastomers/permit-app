using Microsoft.AspNetCore.Mvc;
using PermitControl.Application;

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
    [HttpGet]
    public ActionResult<PermitListResponse> List() => DatabaseOr<PermitListResponse>();

    [HttpGet("{id:guid}")]
    public ActionResult<PermitSummary> Get(Guid id) => DatabaseOr<PermitSummary>();

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
public sealed class SyncController : ControllerBase
{
    [HttpPost("push")]
    public IActionResult Push([FromBody] SyncPushRequest request)
    {
        if (request.Events is null)
        {
            return BadRequest(new { error = "events is required" });
        }

        return StatusCode(StatusCodes.Status501NotImplemented, new { error = "sync-not-implemented" });
    }

    [HttpGet("pull")]
    public IActionResult Pull([FromQuery] DateTimeOffset? since) =>
        StatusCode(StatusCodes.Status501NotImplemented, new { error = "sync-not-implemented", since });
}
