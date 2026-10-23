using Microsoft.AspNetCore.Mvc;
using PermitControl.Application;
using PermitControl.Domain;
using PermitControl.Infrastructure.Identity;

namespace PermitControl.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
public sealed class UsersController(IDatabaseAvailability database, IPlantDirectory directory) : ControllerBase
{
    [HttpGet]
    public Task<ActionResult<IReadOnlyList<UserProfileView>>> List(string? search, bool? enabled, CancellationToken cancellationToken) =>
        Run(() => directory.ListUsersAsync(Token(), search, enabled, cancellationToken));

    [HttpGet("{id}")]
    public async Task<ActionResult<UserProfileView>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (Unavailable() is { } unavailable) return unavailable;
        try
        {
            var user = await directory.GetUserAsync(Token(), id, cancellationToken);
            return user is null ? NotFound(new { error = "user-not-found" }) : Ok(user);
        }
        catch (DirectoryRejected rejected)
        {
            return Status(rejected.Code);
        }
    }

    [HttpPost]
    public Task<ActionResult> Create([FromBody] UserProfileEdit edit, CancellationToken cancellationToken) =>
        Run(async () =>
        {
            var (error, user) = await directory.CreateUserAsync(Token(), edit, cancellationToken);
            return error is null ? Ok(user) : Status(error);
        });

    [HttpPut("{id}")]
    public Task<ActionResult> Update(Guid id, [FromBody] UserProfileEdit edit, CancellationToken cancellationToken) =>
        Empty(() => directory.UpdateUserAsync(Token(), id, edit, cancellationToken));

    [HttpPut("{id}/roles")]
    public Task<ActionResult> Roles(Guid id, [FromBody] RoleAssignmentRequest request, CancellationToken cancellationToken) =>
        Empty(() => directory.SetRolesAsync(Token(), id, request.Roles, request.Pin, request.DeviceId, cancellationToken));

    [HttpPost("{id}/qualifications")]
    public Task<ActionResult> Qualification(Guid id, [FromBody] QualificationRequest request, CancellationToken cancellationToken) =>
        Empty(() => directory.AddQualificationAsync(Token(), id, request.Qualification, cancellationToken));

    [HttpPost("{id}/pin/require-change")]
    public Task<ActionResult> RequireChange(Guid id, [FromBody] AdminPinRequest request, CancellationToken cancellationToken) =>
        Empty(() => directory.RequirePinChangeAsync(Token(), id, request.Pin, request.DeviceId, cancellationToken));

    [HttpPost("{id}/pin/reset-enrollment")]
    public Task<ActionResult> Reset(Guid id, [FromBody] AdminPinRequest request, CancellationToken cancellationToken) =>
        Empty(() => directory.ResetEnrollmentAsync(Token(), id, request.Pin, request.DeviceId, request.Reason, cancellationToken));

    [HttpPost("{id}/pin/unlock")]
    public Task<ActionResult> Unlock(Guid id, [FromBody] AdminPinRequest request, CancellationToken cancellationToken) =>
        Empty(() => directory.UnlockAsync(Token(), id, request.Pin, request.DeviceId, cancellationToken));

    [HttpPost("{id}/enabled")]
    public Task<ActionResult> Enabled(Guid id, [FromBody] EnabledRequest request, CancellationToken cancellationToken) =>
        Empty(() => directory.SetEnabledAsync(Token(), id, request.Enabled, request.Pin, request.DeviceId, cancellationToken));

    private string? Token() => Request.Headers.Authorization.ToString();
    private ActionResult? Unavailable() => database.IsConfigured ? null : StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });

    private async Task<ActionResult<T>> Run<T>(Func<Task<T>> action)
    {
        if (Unavailable() is { } unavailable) return unavailable;
        try { return Ok(await action()); }
        catch (DirectoryRejected rejected) { return Status(rejected.Code); }
    }

    private async Task<ActionResult> Run(Func<Task<ActionResult>> action)
    {
        if (Unavailable() is { } unavailable) return unavailable;
        try { return await action(); }
        catch (DirectoryRejected rejected) { return Status(rejected.Code); }
    }

    private Task<ActionResult> Empty(Func<Task<string?>> action) =>
        Run(async () =>
        {
            var error = await action();
            return error is null ? NoContent() : Status(error);
        });

    private ActionResult Status(string code) => code switch
    {
        "session-required" or "pin-not-accepted" => Unauthorized(new { error = code }),
        "capability-required" => StatusCode(StatusCodes.Status403Forbidden, new { error = code }),
        _ => BadRequest(new { error = code }),
    };
}

public sealed record RoleAssignmentRequest(IReadOnlyList<string> Roles, string? Pin, Guid? DeviceId);
public sealed record QualificationRequest(string Qualification);
public sealed record AdminPinRequest(string Pin, Guid? DeviceId, string? Reason);
public sealed record EnabledRequest(bool Enabled, string? Pin, Guid? DeviceId);
