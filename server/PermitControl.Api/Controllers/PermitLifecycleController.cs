using Microsoft.AspNetCore.Mvc;
using PermitControl.Application;
using PermitControl.Infrastructure.Identity;

namespace PermitControl.Api.Controllers;

[ApiController]
[Route("api/v1/permits")]
public sealed class PermitLifecycleController(IDatabaseAvailability database, IPlantDirectory directory) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PermitLifecycleView>>> List(string? status, CancellationToken cancellationToken)
    {
        if (!database.IsConfigured) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        return Ok(await directory.ListPermitsAsync(status, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PermitLifecycleView>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!database.IsConfigured) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        var permit = await directory.GetPermitAsync(id, cancellationToken);
        return permit is null ? NotFound(new { error = "permit-not-found" }) : Ok(permit);
    }

    [HttpPost("{id:guid}/submit")]
    public Task<ActionResult> Submit(Guid id, [FromBody] LifecycleRequest request, CancellationToken cancellationToken) =>
        Act(() => directory.SubmitAsync(Token(), id, request.DeviceId, cancellationToken));

    [HttpPost("{id:guid}/authorize")]
    public Task<ActionResult> Authorize(Guid id, [FromBody] PinLifecycleRequest request, CancellationToken cancellationToken) =>
        Act(() => directory.AuthorizeAsync(Token(), id, request.Pin, request.Revision, request.DeviceId, cancellationToken));

    [HttpPost("{id:guid}/accept")]
    public Task<ActionResult> Accept(Guid id, [FromBody] PinLifecycleRequest request, CancellationToken cancellationToken) =>
        Act(() => directory.AcceptAsync(Token(), id, request.Pin, request.Revision, request.DeviceId, cancellationToken));

    [HttpPost("{id:guid}/return-for-correction")]
    public Task<ActionResult> ReturnForCorrection(Guid id, [FromBody] RevisionRequest request, CancellationToken cancellationToken) =>
        Act(() => directory.ReturnForCorrectionAsync(Token(), id, request.Revision, request.DeviceId, cancellationToken));

    [HttpPost("{id:guid}/withdraw-authorization")]
    public Task<ActionResult> WithdrawAuthorization(Guid id, [FromBody] WithdrawAuthorizationRequest request, CancellationToken cancellationToken) =>
        Act(() => directory.WithdrawAuthorizationAsync(Token(), id, request.Pin, request.Revision, request.Reason, request.Comments, request.DeviceId, cancellationToken));

    [HttpPost("{id:guid}/activate")]
    public Task<ActionResult> Activate(Guid id, [FromBody] ActivateRequest request, CancellationToken cancellationToken) =>
        Act(() => directory.ActivateAsync(Token(), id, request.Pin, request.Revision, request.ActingRole, request.DeviceId, cancellationToken));

    private string? Token() => Request.Headers.Authorization.ToString();

    private async Task<ActionResult> Act(Func<Task<string?>> action)
    {
        if (!database.IsConfigured) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        try
        {
            var error = await action();
            return error is null ? NoContent() : Status(error);
        }
        catch (DirectoryRejected rejected)
        {
            return Status(rejected.Code);
        }
    }

    private ActionResult Status(string code) => code switch
    {
        "session-required" or "pin-not-accepted" => Unauthorized(new { error = code }),
        "capability-required" => StatusCode(StatusCodes.Status403Forbidden, new { error = code }),
        _ => BadRequest(new { error = code }),
    };
}

public sealed record LifecycleRequest(Guid? DeviceId);
public sealed record RevisionRequest(int Revision, Guid? DeviceId);
public sealed record PinLifecycleRequest(string Pin, int Revision, Guid? DeviceId);
public sealed record ActivateRequest(string Pin, int Revision, string? ActingRole, Guid? DeviceId);
public sealed record WithdrawAuthorizationRequest(string Pin, int Revision, string? Reason, string? Comments, Guid? DeviceId);
