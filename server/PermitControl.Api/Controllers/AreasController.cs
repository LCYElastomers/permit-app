using Microsoft.AspNetCore.Mvc;
using PermitControl.Application;
using PermitControl.Domain;

namespace PermitControl.Api.Controllers;

/// <summary>
/// Area reference data. Add <c>[Authorize(Policy = PermitAuthorization.ReadReferenceData)]</c>
/// and <c>PermitAuthorization.WriteReferenceData</c> when authentication exists.
/// </summary>
[ApiController]
[Route("api/v1/areas")]
public sealed class AreasController(IDatabaseAvailability database, IAreaCatalog areas) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AreaResponse>>> List(CancellationToken cancellationToken)
    {
        if (Unavailable() is { } unavailable)
        {
            return unavailable;
        }

        return Ok(await areas.ListAsync(cancellationToken));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AreaResponse>> Get(string id, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(id, out var areaId) || areaId == Guid.Empty)
        {
            return BadRequest(new { error = AreaRegistration.IdInvalid });
        }

        if (Unavailable() is { } unavailable)
        {
            return unavailable;
        }

        var area = await areas.GetAsync(areaId, cancellationToken);
        return area is null
            ? NotFound(new { error = "area not found" })
            : Ok(area);
    }

    [HttpPost]
    public async Task<ActionResult<AreaResponse>> Create([FromBody] CreateAreaRequest? request, CancellationToken cancellationToken)
    {
        if (!AreaRegistration.TryNormalize(request?.Name, out _, out var error))
        {
            return BadRequest(new { error });
        }

        if (request!.Id == Guid.Empty)
        {
            return BadRequest(new { error = AreaRegistration.IdInvalid });
        }

        if (Unavailable() is { } unavailable)
        {
            return unavailable;
        }

        var result = await areas.CreateAsync(request.Id, request.Name, cancellationToken);
        return result.Kind switch
        {
            AreaPreparationKind.Ready => Created($"/api/v1/areas/{result.Id}", new AreaResponse(result.Id, result.Name)),
            AreaPreparationKind.Conflict => Conflict(new { error = result.Error }),
            _ => BadRequest(new { error = result.Error }),
        };
    }

    private ObjectResult? Unavailable() =>
        database.IsConfigured
            ? null
            : StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
}
