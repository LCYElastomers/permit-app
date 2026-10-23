using Microsoft.AspNetCore.Mvc;
using PermitControl.Application;
using PermitControl.Domain;
using PermitControl.Infrastructure.Identity;

namespace PermitControl.Api.Controllers;

[ApiController]
[Route("api/v1/identity")]
public sealed class IdentityController(IDatabaseAvailability database, IPlantDirectory directory) : ControllerBase
{
    [HttpPost("sessions")]
    public async Task<ActionResult<IdentityBootstrap>> Open([FromBody] WindowsSessionRequest request, CancellationToken cancellationToken)
    {
        if (Unavailable() is { } unavailable) return unavailable;
        return Ok(await directory.OpenWindowsAsync(request.WindowsDomain, request.WindowsUsername, cancellationToken));
    }

    [HttpPost("sessions/confirm")]
    public Task<ActionResult<SessionStart>> Confirm([FromBody] ConfirmSessionRequest request, CancellationToken cancellationToken) =>
        Run(() => directory.ConfirmAsync(request.UserId, request.Pin, request.DeviceId, cancellationToken));

    [HttpGet("session")]
    public async Task<ActionResult<UserProfileView>> Current(CancellationToken cancellationToken)
    {
        if (Unavailable() is { } unavailable) return unavailable;
        var user = await directory.CurrentAsync(Token(), cancellationToken);
        return user is null ? Unauthorized(new { error = "session-required" }) : Ok(user);
    }

    [HttpPost("pin")]
    public Task<ActionResult> Enroll([FromBody] EnrollPinRequest request, CancellationToken cancellationToken) =>
        Run(async () =>
        {
            var error = await directory.EnrollAsync(Token(), request.Pin, request.ConfirmPin, request.DeviceId, cancellationToken);
            return error is null ? NoContent() : Status(error);
        });

    [HttpPost("pin/change")]
    public Task<ActionResult> Change([FromBody] ChangePinRequest request, CancellationToken cancellationToken) =>
        Run(async () =>
        {
            var error = await directory.ChangePinAsync(Token(), request.CurrentPin, request.NewPin, request.ConfirmPin, request.DeviceId, cancellationToken);
            return error is null ? NoContent() : Status(error);
        });

    private string? Token() => Request.Headers.Authorization.ToString();

    private ActionResult? Unavailable() => database.IsConfigured ? null : StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });

    private async Task<ActionResult<T>> Run<T>(Func<Task<T>> action)
    {
        if (Unavailable() is { } unavailable) return unavailable;
        try
        {
            return Ok(await action());
        }
        catch (DirectoryRejected rejected)
        {
            return Status(rejected.Code);
        }
    }

    private async Task<ActionResult> Run(Func<Task<ActionResult>> action)
    {
        if (Unavailable() is { } unavailable) return unavailable;
        try
        {
            return await action();
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

public sealed record WindowsSessionRequest(string? WindowsDomain, string? WindowsUsername);
public sealed record ConfirmSessionRequest(Guid UserId, string Pin, Guid? DeviceId);
public sealed record EnrollPinRequest(string Pin, string ConfirmPin, Guid? DeviceId);
public sealed record ChangePinRequest(string CurrentPin, string NewPin, string ConfirmPin, Guid? DeviceId);
