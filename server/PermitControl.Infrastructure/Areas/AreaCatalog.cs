using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PermitControl.Application;
using PermitControl.Domain;
using PermitControl.Infrastructure.Persistence;

namespace PermitControl.Infrastructure.Areas;

public sealed class AreaCatalog(PermitDbContext database) : IAreaCatalog
{
    public Task<IReadOnlyList<AreaResponse>> ListAsync(CancellationToken cancellationToken) =>
        Read(async () =>
        {
            var rows = await database.Areas
                .AsNoTracking()
                .Where(area => area.Enabled)
                .OrderBy(area => area.Name)
                .ThenBy(area => area.Id)
                .Select(area => new AreaResponse(area.Id, area.Name))
                .ToListAsync(cancellationToken);
            return (IReadOnlyList<AreaResponse>)rows;
        });

    public Task<AreaResponse?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Read(() => database.Areas
            .AsNoTracking()
            .Where(area => area.Id == id)
            .Select(area => new AreaResponse(area.Id, area.Name))
            .FirstOrDefaultAsync(cancellationToken));

    public async Task<AreaPreparation> CreateAsync(Guid? id, string? name, CancellationToken cancellationToken)
    {
        if (!AreaRegistration.TryNormalize(name, out var normalized, out var error))
        {
            return AreaPreparation.Invalid(error!);
        }

        if (id == Guid.Empty)
        {
            return AreaPreparation.Invalid(AreaRegistration.IdInvalid);
        }

        var nameExists = await Read(() => database.Areas.AsNoTracking().AnyAsync(area => area.Name == normalized, cancellationToken));
        var suppliedIdExists = id is Guid supplied
            && await Read(() => database.Areas.AsNoTracking().AnyAsync(area => area.Id == supplied, cancellationToken));
        var decision = AreaRegistration.Decide(id, normalized, suppliedIdExists, nameExists);
        if (decision.Kind != AreaPreparationKind.Ready)
        {
            return decision;
        }

        database.Areas.Add(new Area { Id = decision.Id, Name = decision.Name });
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (TryUniqueViolation(exception, out var constraint))
        {
            return AreaPreparation.Conflict(ConflictError(constraint));
        }
        catch (Exception exception) when (IsDatabaseFailure(exception))
        {
            throw new DatabaseUnavailableException();
        }

        return decision;
    }

    private static async Task<T> Read<T>(Func<Task<T>> query)
    {
        try
        {
            return await query();
        }
        catch (Exception exception) when (IsDatabaseFailure(exception))
        {
            throw new DatabaseUnavailableException();
        }
    }

    private static bool TryUniqueViolation(DbUpdateException exception, out string? constraint)
    {
        constraint = null;
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres && postgres.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                constraint = postgres.ConstraintName;
                return true;
            }
        }

        return false;
    }

    private static string ConflictError(string? constraint)
    {
        if (constraint is not null && constraint.Contains("Name", StringComparison.OrdinalIgnoreCase))
        {
            return AreaRegistration.DuplicateName;
        }

        if (constraint is not null && (constraint.Contains("PK_", StringComparison.Ordinal) || constraint.Contains("Id", StringComparison.OrdinalIgnoreCase)))
        {
            return AreaRegistration.DuplicateId;
        }

        return AreaRegistration.Duplicate;
    }

    private static bool IsDatabaseFailure(Exception exception) =>
        exception is DbException or DbUpdateException;
}
