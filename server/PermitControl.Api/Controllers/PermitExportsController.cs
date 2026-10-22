using Microsoft.AspNetCore.Mvc;
using PermitControl.Application;
using PermitControl.Domain;

namespace PermitControl.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class PermitExportsController(IDatabaseAvailability database, IPermitPdfExport exports) : ControllerBase
{
    [HttpPost("permits/{id:guid}/exports/pdf")]
    public async Task<IActionResult> Create(Guid id, [FromBody] PermitPdfExportBody? body, CancellationToken cancellationToken)
    {
        if (!database.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        }

        if (!TryType(body?.ExportType, out var exportType, out var error))
        {
            return BadRequest(new { error });
        }

        try
        {
            var prepared = await exports.CreateAsync(id, exportType, cancellationToken);
            return prepared.Kind switch
            {
                PermitPdfKind.NotFound => NotFound(new { error = "permit not found" }),
                PermitPdfKind.Invalid => BadRequest(new { error = prepared.Error }),
                _ => Ok(prepared.Receipt),
            };
        }
        catch (FileStorageException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "file-storage-unavailable" });
        }
        catch (DatabaseUnavailableException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-unavailable" });
        }
    }

    [HttpGet("permit-exports/{exportId:guid}/content")]
    public async Task<IActionResult> Content(Guid exportId, CancellationToken cancellationToken)
    {
        if (!database.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-not-configured" });
        }

        try
        {
            var file = await exports.OpenAsync(exportId, cancellationToken);
            if (file is null) return NotFound(new { error = "export not found" });
            return File(file.Content, file.MimeType, file.Filename);
        }
        catch (FileStorageException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "file-storage-unavailable" });
        }
        catch (DatabaseUnavailableException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "database-unavailable" });
        }
    }

    private static bool TryType(string? value, out PermitExportType exportType, out string error)
    {
        if (string.IsNullOrWhiteSpace(value) || value == nameof(PermitExportType.PRINT))
        {
            exportType = PermitExportType.PRINT;
            error = "";
            return true;
        }

        if (value == nameof(PermitExportType.SNAPSHOT))
        {
            exportType = PermitExportType.SNAPSHOT;
            error = "";
            return true;
        }

        exportType = default;
        error = value == nameof(PermitExportType.FINAL_ARCHIVE) ? "final-archive-not-available" : "export-type-invalid";
        return false;
    }
}
