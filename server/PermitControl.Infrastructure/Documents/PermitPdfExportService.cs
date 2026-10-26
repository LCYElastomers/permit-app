using Microsoft.EntityFrameworkCore;
using PermitControl.Application;
using PermitControl.Domain;
using PermitControl.Infrastructure.Persistence;

namespace PermitControl.Infrastructure.Documents;

public sealed class PermitPdfExportService(PermitDbContext database, IPermitPdfRenderer renderer, IFileStorage storage) : IPermitPdfExport
{
    public async Task<PermitPdfPrepared> CreateAsync(Guid permitId, PermitExportType exportType, CancellationToken cancellationToken)
    {
        if (permitId == Guid.Empty) return PermitPdfPrepared.NotFound();
        var source = await LoadAsync(permitId, cancellationToken);
        var prepared = PermitPdfExporting.Prepare(source, exportType, Guid.NewGuid(), DateTimeOffset.UtcNow, renderer.Render);
        if (prepared.Kind != PermitPdfKind.Ready || prepared.Export is null || prepared.Content is null) return prepared;

        await storage.SaveAsync(
            new FileSaveRequest(prepared.Export.Id, prepared.Receipt?.Filename ?? "permit.pdf", "application/pdf", prepared.Content, prepared.Export.StorageKey),
            cancellationToken);
        database.PermitExports.Add(prepared.Export);
        await database.SaveChangesAsync(cancellationToken);
        return prepared;
    }

    public async Task<PermitPdfFile?> OpenAsync(Guid exportId, CancellationToken cancellationToken)
    {
        if (exportId == Guid.Empty) return null;
        var export = await database.PermitExports.AsNoTracking().FirstOrDefaultAsync(item => item.Id == exportId, cancellationToken);
        if (export is null) return null;
        var permit = await database.Permits.AsNoTracking().FirstOrDefaultAsync(item => item.Id == export.PermitId, cancellationToken);
        var content = await storage.ReadAsync(export.StorageKey, cancellationToken);
        if (content is null) return null;
        return new PermitPdfFile
        {
            Content = content,
            Filename = PermitExportKeys.DownloadName(permit?.PermitNumber, export.PermitRevision),
            MimeType = string.IsNullOrWhiteSpace(export.MimeType) ? "application/pdf" : export.MimeType,
        };
    }

    private async Task<AuthoritativeGeneralWork?> LoadAsync(Guid permitId, CancellationToken cancellationToken)
    {
        var permit = await database.Permits.AsNoTracking()
            .Include(item => item.Area)
            .Include(item => item.Equipment)
            .Include(item => item.Contractor)
            .FirstOrDefaultAsync(item => item.Id == permitId, cancellationToken);
        if (permit is null) return null;
        var facts = await database.PermitEvents.AsNoTracking()
            .Where(item => item.PermitId == permitId && item.EventType == PermitEventType.PERMIT_CREATED)
            .OrderBy(item => item.RecordedAt)
            .Select(item => item.Payload)
            .FirstOrDefaultAsync(cancellationToken);
        var suspension = await database.PermitSuspensions.AsNoTracking()
            .Where(item => item.PermitId == permitId)
            .OrderByDescending(item => item.SuspendedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var suspendedBy = suspension is null
            ? null
            : await database.Users.AsNoTracking()
                .Where(user => user.Id == suspension.SuspendedBy)
                .Select(user => new { user.DisplayName, user.PermitUserCode })
                .FirstOrDefaultAsync(cancellationToken);
        return new AuthoritativeGeneralWork
        {
            Permit = permit,
            AreaName = permit.Area?.Name,
            EquipmentTag = permit.Equipment?.Tag,
            CompanyName = permit.Contractor?.Name,
            Hazards = await database.PermitHazards.AsNoTracking().Where(item => item.PermitId == permitId).ToListAsync(cancellationToken),
            Controls = await database.PermitControls.AsNoTracking().Where(item => item.PermitId == permitId).ToListAsync(cancellationToken),
            Ppe = await database.PermitPpe.AsNoTracking().Where(item => item.PermitId == permitId).ToListAsync(cancellationToken),
            Modules = await database.PermitModules.AsNoTracking().Where(item => item.PermitId == permitId).ToListAsync(cancellationToken),
            Participants = await database.PermitParticipants.AsNoTracking().Where(item => item.PermitId == permitId).ToListAsync(cancellationToken),
            CreationFactsJson = facts,
            ModuleFacts = await database.PermitModuleFacts.AsNoTracking().Where(item => item.PermitId == permitId).ToListAsync(cancellationToken),
            Approvals = await database.PermitApprovals.AsNoTracking().Where(item => item.PermitId == permitId).ToListAsync(cancellationToken),
            SuspensionReason = suspension?.Reason,
            SuspendedAt = suspension?.SuspendedAt,
            SuspendedByName = suspendedBy?.DisplayName,
            SuspendedByCode = suspendedBy?.PermitUserCode,
        };
    }
}
