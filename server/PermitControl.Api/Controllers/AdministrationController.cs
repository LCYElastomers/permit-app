using Microsoft.AspNetCore.Mvc;
using PermitControl.Application;
using PermitControl.Infrastructure.Identity;

namespace PermitControl.Api.Controllers;

[ApiController]
[Route("api/v1/administration")]
public sealed class AdministrationController(IDatabaseAvailability database, IPlantAdministration administration) : ControllerBase
{
    [HttpGet("{catalog}")]
    public Task<ActionResult<IReadOnlyList<CatalogItemView>>> List(string catalog, CancellationToken cancellationToken) =>
        Run(() => administration.ListAsync(Token(), catalog, cancellationToken));

    [HttpPost("{catalog}")]
    public Task<ActionResult> Save(string catalog, [FromBody] CatalogEdit edit, CancellationToken cancellationToken) =>
        Run(async () =>
        {
            var (error, item) = await administration.SaveAsync(Token(), catalog, edit, cancellationToken);
            return error is null ? Ok(item) : Status(error);
        });

    [HttpGet("forms/fields")]
    public Task<ActionResult<IReadOnlyList<FieldView>>> Fields(CancellationToken cancellationToken) =>
        Run(() => administration.FieldsAsync(Token(), cancellationToken));

    [HttpPost("forms/fields")]
    public Task<ActionResult> SaveField([FromBody] FieldEdit edit, CancellationToken cancellationToken) =>
        Run(async () =>
        {
            var (error, field) = await administration.SaveFieldAsync(Token(), edit, cancellationToken);
            return error is null ? Ok(field) : Status(error);
        });

    [HttpPost("forms/choices")]
    public Task<ActionResult> SaveChoice([FromBody] ChoiceEdit edit, CancellationToken cancellationToken) =>
        Complete(() => administration.SaveChoiceAsync(Token(), edit, cancellationToken));

    [HttpPost("forms/publish")]
    public Task<ActionResult> Publish([FromBody] PinBody body, CancellationToken cancellationToken) =>
        Complete(() => administration.PublishAsync(Token(), body.Pin, body.DeviceId, cancellationToken));

    [HttpGet("forms/rules")]
    public Task<ActionResult<IReadOnlyList<RuleView>>> Rules(CancellationToken cancellationToken) =>
        Run(() => administration.RulesAsync(Token(), cancellationToken));

    [HttpPost("forms/rules")]
    public Task<ActionResult> SaveRule([FromBody] RuleBody body, CancellationToken cancellationToken) =>
        Complete(() => administration.SaveRuleAsync(Token(), body.Rule, body.Pin, body.DeviceId, cancellationToken));

    [HttpGet("forms/version")]
    public Task<ActionResult<int>> Version(CancellationToken cancellationToken) =>
        Run(() => administration.PublishedVersionAsync(Token(), cancellationToken));

    [HttpGet("permit-types")]
    public Task<ActionResult<IReadOnlyList<PermitTypeView>>> Types(CancellationToken cancellationToken) =>
        Run(() => administration.PermitTypesAsync(Token(), cancellationToken));

    private string? Token() => Request.Headers.Authorization.ToString();

    private async Task<ActionResult<T>> Run<T>(Func<Task<T>> action)
    {
        if (!database.IsConfigured) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        try { return Ok(await action()); }
        catch (DirectoryRejected rejected) { return Status(rejected.Code); }
    }

    private async Task<ActionResult> Run(Func<Task<ActionResult>> action)
    {
        if (!database.IsConfigured) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        try { return await action(); }
        catch (DirectoryRejected rejected) { return Status(rejected.Code); }
    }

    private async Task<ActionResult> Complete(Func<Task<string?>> action)
    {
        if (!database.IsConfigured) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        try
        {
            var error = await action();
            return error is null ? NoContent() : Status(error);
        }
        catch (DirectoryRejected rejected) { return Status(rejected.Code); }
    }

    private ActionResult Status(string code) => code switch
    {
        "session-required" or "pin-not-accepted" => Unauthorized(new { error = code }),
        "capability-required" => StatusCode(StatusCodes.Status403Forbidden, new { error = code }),
        _ => BadRequest(new { error = code }),
    };
}

public sealed record PinBody(string Pin, Guid? DeviceId);
public sealed record RuleBody(RuleEdit Rule, string Pin, Guid? DeviceId);
